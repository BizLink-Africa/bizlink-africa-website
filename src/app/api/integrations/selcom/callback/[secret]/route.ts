import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logAuditEvent } from '@/lib/audit';
import {
  selcomCallbackSchema,
  timingSafeStringEqual,
  maskCallbackAccountNumber,
  processSelcomCallback,
  notifyCallbackFailure,
} from '@/lib/selcom/callback';

// Selcom transaction callback endpoint — see the migration header comment
// on 20260821000000_selcom_callback_endpoint.sql for what was actually
// confirmed in Selcom's official callback documentation before this was
// written. Summary: POST to a merchant-configured HTTPS URL, always
// carrying `reference_id` + `status` ("SUCCESS" — callbacks are only sent
// for successful transactions; a failed/unresolved payout is never
// reported this way, only via status-check-service.ts's polling). No
// signature/HMAC scheme is documented, so none is checked here — this
// route's protection is the secret path segment below plus
// process_selcom_callback()'s reference/amount/destination/state guards.
export const dynamic = 'force-dynamic';

function timingSafeSecretMatch(candidate: string, configured: string | undefined): boolean {
  if (!configured) return false;
  return timingSafeStringEqual(candidate, configured);
}

export async function POST(request: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;

  // Wrong/missing secret gets a 404, not 401 — never confirm to an
  // internet scanner that a callback endpoint exists at all here.
  if (!timingSafeSecretMatch(secret, process.env.SELCOM_CALLBACK_SECRET)) {
    console.warn('[selcom-callback] Rejected a request with an invalid callback secret path.');
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // HTTPS only. Vercel terminates TLS and forwards internally over http,
  // so the protocol has to be read from the forwarded-proto header, not
  // request.url. The header is simply absent for local dev (no reverse
  // proxy in front), so it's only enforced when present.
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedProto && forwardedProto !== 'https') {
    return NextResponse.json({ error: 'HTTPS required' }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = selcomCallbackSchema.safeParse(rawBody);
  if (!parsed.success) {
    console.warn('[selcom-callback] Rejected a malformed callback payload', parsed.error.flatten());
    return NextResponse.json({ error: 'Malformed callback payload' }, { status: 400 });
  }
  const payload = parsed.data;

  const forwardedFor = request.headers.get('x-forwarded-for');
  const sourceIp = forwardedFor ? forwardedFor.split(',')[0].trim() : request.headers.get('x-real-ip');

  const supabase = createServiceClient();
  const amountText = payload.amount === undefined ? null : String(payload.amount);
  const maskedSender = maskCallbackAccountNumber(payload.sender_account_number);
  const maskedRecipient = maskCallbackAccountNumber(payload.recipient_account_number);

  let result;
  try {
    result = await processSelcomCallback(supabase, {
      referenceId: payload.reference_id,
      rawStatus: payload.status,
      selcomReceipt: payload.selcom_receipt ?? null,
      amount: amountText,
      maskedSenderAccountNumber: maskedSender,
      senderAccountName: payload.sender_account_name ?? null,
      maskedRecipientAccountNumber: maskedRecipient,
      recipientName: payload.recipient_name ?? null,
      charges: payload.charges,
      sourceIp,
      performedBy: 'selcom_callback',
      dryRun: false,
    });
  } catch (err) {
    console.error('[selcom-callback] process_selcom_callback RPC failed', err);
    await logAuditEvent({
      performedBy: 'selcom_callback',
      actionType: 'callback_received',
      module: 'selcom_callback',
      result: 'failure',
      reason: err instanceof Error ? err.message : 'process_selcom_callback failed.',
      newValue: { referenceId: payload.reference_id, status: payload.status },
      client: supabase,
    });
    // Honest failure signal, not a swallowed 200 — a DB error isn't a
    // transient condition Selcom retrying immediately would fix, but
    // returning it as an error (rather than pretending we accepted it)
    // means a monitoring alert on this route firing is meaningful.
    return NextResponse.json({ error: 'Failed to process callback' }, { status: 500 });
  }

  await Promise.all([
    logAuditEvent({
      performedBy: 'selcom_callback',
      actionType: 'callback_received',
      module: 'selcom_callback',
      recordId: result.payoutId ?? undefined,
      result: result.outcome === 'processed' ? 'success' : 'failure',
      reason: result.rejectionReason ?? undefined,
      // Never the raw account numbers — masked values only.
      newValue: {
        referenceId: payload.reference_id,
        status: payload.status,
        outcome: result.outcome,
        maskedSender,
        maskedRecipient,
      },
      client: supabase,
    }),
    notifyCallbackFailure(supabase, result.outcome, payload.reference_id, result.rejectionReason, result.payoutId),
  ]);

  // Prompt, minimal acknowledgement — Selcom's docs don't specify an
  // expected response body/shape, so nothing here is invented beyond a
  // plain 200. Returned for every outcome we successfully recorded
  // (including mismatches/unknown references), not just 'processed', so
  // Selcom doesn't retry-storm us for cases we've already safely handled
  // and queued for manual review.
  return NextResponse.json({ received: true });
}
