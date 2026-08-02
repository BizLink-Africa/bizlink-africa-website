import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { checkPayoutStatus } from '@/lib/payouts/status-check-service';
import { isEligibleForScheduledPoll } from '@/lib/payouts/selcom-status-mapping';

// Scheduled Selcom status polling — see vercel.json's `crons` entry for
// this route. Protected by CRON_SECRET (Vercel's documented convention:
// automatically attached as `Authorization: Bearer <CRON_SECRET>` on
// cron-triggered requests — see
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
// Never reachable by an unauthenticated caller, and never creates a new
// disbursement — this route only ever calls the read-only Transaction
// Query endpoint via the same central status-check-service.ts the manual
// "Check Status" action uses.
export const dynamic = 'force-dynamic';

const BATCH_LIMIT = 50;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: candidates, error: fetchError } = await supabase
    .from('merchant_payouts')
    .select('id, payout_reference, status, status_check_count, status_check_expires_at')
    .in('status', ['submitted', 'processing', 'unknown'])
    .lte('next_status_check_at', now)
    .limit(BATCH_LIMIT);

  if (fetchError) {
    console.error('[status-check-cron] Failed to fetch eligible payouts', fetchError);
    return NextResponse.json({ error: 'Failed to fetch eligible payouts' }, { status: 500 });
  }

  let checked = 0;
  let expired = 0;
  let errored = 0;

  for (const payout of candidates ?? []) {
    // Defensive re-check — the query already filters by status, but a
    // shared constant keeps "which statuses are pollable" defined in
    // exactly one place (selcom-status-mapping.ts) rather than duplicated
    // here.
    if (!isEligibleForScheduledPoll(payout.status)) continue;

    // Stop polling after the configured window — move to Manual Review
    // instead of checking again. Never creates a new transaction; only
    // ever a status transition + audit event.
    if (payout.status_check_expires_at && new Date(payout.status_check_expires_at) <= new Date()) {
      const { error } = await supabase.rpc('expire_payout_status_check', {
        p_payout_id: payout.id,
        p_performed_by: 'system',
      });
      if (error) {
        console.error('[status-check-cron] Failed to expire payout', payout.id, error);
        errored += 1;
      } else {
        expired += 1;
      }
      continue;
    }

    try {
      await checkPayoutStatus(supabase, payout, { triggerType: 'scheduled', performedBy: 'system' });
      checked += 1;
    } catch (err) {
      console.error('[status-check-cron] Unexpected error checking payout', payout.id, err);
      errored += 1;
    }
  }

  return NextResponse.json({ candidates: candidates?.length ?? 0, checked, expired, errored });
}
