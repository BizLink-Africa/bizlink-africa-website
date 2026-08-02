import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { createServiceClient } from '@/lib/supabase/service';
import { maskCredential } from '@/lib/security/mask';

// Everything shared between the real callback route
// (src/app/api/integrations/selcom/callback/[secret]/route.ts) and the
// sandbox Callback Testing panel's server actions, so the two paths can
// never quietly diverge on validation, masking, or the notification rule.

// Strict request schema — reference_id and status are always documented as
// present; everything else is optional per Selcom's callback field
// configuration. Rejects anything not shaped like this rather than passing
// unknown fields through.
export const selcomCallbackSchema = z.object({
  reference_id: z.string().trim().min(1).max(128),
  status: z.string().trim().min(1).max(32),
  sender_account_name: z.string().trim().max(200).optional(),
  sender_account_number: z.string().trim().min(1).max(64).optional(),
  recipient_name: z.string().trim().max(200).optional(),
  recipient_account_number: z.string().trim().min(1).max(64).optional(),
  amount: z.union([z.number(), z.string().trim().min(1).max(32)]).optional(),
  charges: z.unknown().optional(),
  selcom_receipt: z.string().trim().max(128).optional(),
});

export type SelcomCallbackBody = z.infer<typeof selcomCallbackSchema>;

// Constant-time comparison for the callback secret path segment — a
// straight `===` leaks how many leading characters matched via response
// timing. Both inputs are attacker-influenced (the path segment is
// whatever the caller put in the URL), so this is worth the few extra
// lines even though the rest of this codebase's bearer-secret checks
// (e.g. the status-check cron route) use plain equality.
export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// The only place a raw callback account number is ever touched — masked
// immediately, with the exact same function that produced
// merchant_settlement_beneficiaries.masked_destination_value in the first
// place, so process_selcom_callback()'s destination match is a same-shape
// string comparison. Never store, log, or pass the raw value anywhere else.
export function maskCallbackAccountNumber(raw: string | undefined): string | null {
  return raw ? maskCredential(raw) : null;
}

export interface ProcessCallbackParams {
  referenceId: string;
  rawStatus: string;
  selcomReceipt: string | null;
  amount: string | null;
  maskedSenderAccountNumber: string | null;
  senderAccountName: string | null;
  maskedRecipientAccountNumber: string | null;
  recipientName: string | null;
  charges: unknown;
  sourceIp: string | null;
  performedBy: string;
  dryRun?: boolean;
}

export interface ProcessCallbackResult {
  outcome: string;
  payoutId: string | null;
  rejectionReason: string | null;
}

type CallbackSupabaseClient = Pick<ReturnType<typeof createServiceClient>, 'rpc'>;

// Thin wrapper around the process_selcom_callback() RPC — the ONLY place
// this app ever calls it, so the real route and the sandbox dry-run/live
// test action are guaranteed to exercise identical logic.
export async function processSelcomCallback(
  supabase: CallbackSupabaseClient,
  params: ProcessCallbackParams
): Promise<ProcessCallbackResult> {
  const { data, error } = await supabase.rpc('process_selcom_callback', {
    p_reference_id: params.referenceId,
    p_raw_status: params.rawStatus,
    p_selcom_receipt: params.selcomReceipt,
    p_amount: params.amount,
    p_masked_sender_account_number: params.maskedSenderAccountNumber,
    p_sender_account_name: params.senderAccountName,
    p_masked_recipient_account_number: params.maskedRecipientAccountNumber,
    p_recipient_name: params.recipientName,
    p_charges: params.charges ?? null,
    p_source_ip: params.sourceIp,
    p_performed_by: params.performedBy,
    p_dry_run: params.dryRun ?? false,
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = (data as Array<{ outcome: string; payout_id: string | null; rejection_reason: string | null }> | null)?.[0];
  if (!row) {
    throw new Error('process_selcom_callback returned no result.');
  }

  return { outcome: row.outcome, payoutId: row.payout_id, rejectionReason: row.rejection_reason };
}

// Outcomes worth surfacing as an in-app alert (admin_notifications) —
// requirement: "callback-event monitoring and failure alerts". 'duplicate'
// and 'dry_run_ok' are expected, routine outcomes, never alerted on.
export const CALLBACK_ALERT_OUTCOMES: readonly string[] = [
  'reference_not_found',
  'unexpected_status',
  'amount_mismatch',
  'destination_mismatch',
  'invalid_state',
];

export function shouldAlertOnCallbackOutcome(outcome: string): boolean {
  return CALLBACK_ALERT_OUTCOMES.includes(outcome);
}

// The only place outside config.ts/status.ts that touches
// process.env.SELCOM_CALLBACK_SECRET directly — kept here, not in
// actions.ts, so the UI-facing action layer never handles a raw secret
// itself (same discipline selcom-integration-permissions.test.ts already
// enforces for the other Selcom secrets). Used only by the sandbox
// Callback Testing panel's "send live" mode, to call this app's own
// deployed callback route exactly as Selcom would.
export function getLiveCallbackTestUrl(): { url: string } | { error: string } {
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL;
  const callbackSecret = process.env.SELCOM_CALLBACK_SECRET;
  if (!adminUrl || !callbackSecret) {
    return { error: 'NEXT_PUBLIC_ADMIN_URL or SELCOM_CALLBACK_SECRET is not configured.' };
  }
  return { url: `${adminUrl.replace(/\/+$/, '')}/api/integrations/selcom/callback/${callbackSecret}` };
}

const OUTCOME_ALERT_TITLE: Record<string, string> = {
  reference_not_found: 'Selcom callback for an unknown reference',
  unexpected_status: 'Selcom callback with an unexpected status',
  amount_mismatch: 'Selcom callback amount mismatch',
  destination_mismatch: 'Selcom callback destination mismatch',
  invalid_state: 'Selcom callback for a payout in an unexpected state',
};

type NotifySupabaseClient = Pick<ReturnType<typeof createServiceClient>, 'from'>;

// Best-effort in-app alert for Finance/Compliance — inserted via the
// service-role client (admin_notifications' insert policy requires
// notifications.manage, which a callback has no staff session to satisfy;
// the service role bypasses RLS the same way it does for merchant_payouts
// writes). Never throws: a failed alert must not affect the callback's own
// HTTP response.
export async function notifyCallbackFailure(
  supabase: NotifySupabaseClient,
  outcome: string,
  referenceId: string,
  rejectionReason: string | null,
  payoutId: string | null
): Promise<void> {
  if (!shouldAlertOnCallbackOutcome(outcome)) return;

  const title = OUTCOME_ALERT_TITLE[outcome] ?? 'Selcom callback anomaly';
  const priority = outcome === 'destination_mismatch' || outcome === 'amount_mismatch' ? 'urgent' : 'high';

  const { error } = await supabase.from('admin_notifications').insert({
    title,
    message: `Reference ${referenceId}: ${rejectionReason ?? outcome}. Review in Administration → Integrations → Disbursement API → Recent Callback Events.`,
    priority,
    department: 'Finance',
    related_module: 'selcom_callback',
    related_record_id: payoutId,
    created_by: 'selcom_callback',
  });

  if (error) {
    console.error('[selcom-callback] Failed to write admin_notifications alert', error);
  }
}
