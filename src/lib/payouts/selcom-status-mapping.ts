import 'server-only';

// ── THE single central configuration mapping Selcom's external status
// vocabulary onto this app's internal merchant_payouts.status values, plus
// the polling schedule/expiry constants that drive the scheduled
// status-check service (src/lib/payouts/status-check-service.ts). No
// other file in this app should compare a raw Selcom status string or
// hardcode a backoff/expiry number — everything about "what does this
// external status mean, and how often do we re-check" lives here.

// ── External (Selcom-documented) status vocabulary ──────────────────────
// Grounded exactly in developer.selcom.business's Transaction Process /
// Transaction Query documentation, which documents exactly three status
// strings:
//
//   ACCEPTED  — explicitly documented as "async": the transaction was
//               received/queued, NOT yet finalized. Must never be treated
//               as successful.
//   COMPLETED — explicitly documented as "sync": the transaction finished.
//               The only status that means a payout actually succeeded.
//   FAILED    — documented on the Transaction Query response as a
//               possible terminal status.
//
// No other status string is documented for either endpoint.
export const DOCUMENTED_EXTERNAL_STATUSES = ['ACCEPTED', 'COMPLETED', 'FAILED'] as const;
export type DocumentedExternalStatus = (typeof DOCUMENTED_EXTERNAL_STATUSES)[number];

// ── Internal payout lifecycle ────────────────────────────────────────────
// The full state list this app's payout status-check service reasons
// about. 'held' is retained alongside these — a separate, pre-existing
// hold/release mechanism (Place on Hold / Release Hold) with its own
// dedicated actions, not part of Selcom status resolution, kept here only
// so callers that enumerate "every status this column can hold" see the
// complete picture in one place.
export const INTERNAL_PAYOUT_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'submitted',
  'processing',
  'successful',
  'failed',
  'unknown',
  'manual_review',
  'reversed',
  'held',
  'cancelled',
] as const;
export type InternalPayoutStatus = (typeof INTERNAL_PAYOUT_STATUSES)[number];

// Once reached, a payout is finalised — the status-check service's guard
// (apply_payout_status_check_result's terminal-state check) refuses to
// ever move a payout OUT of one of these from a Selcom-derived update, so
// a late/stale/delayed response can never downgrade an already-resolved
// payout.
export const TERMINAL_PAYOUT_STATUSES: readonly InternalPayoutStatus[] = ['successful', 'failed', 'reversed', 'cancelled', 'manual_review'];

export function isTerminalPayoutStatus(status: string): boolean {
  return (TERMINAL_PAYOUT_STATUSES as readonly string[]).includes(status);
}

// Internal statuses eligible for the scheduled status-check poller —
// exactly the set requested: a payout Selcom has ACCEPTED (our
// 'processing'), one we've SUBMITTED but not yet heard back on, or one
// whose last check came back UNKNOWN.
export const SCHEDULED_POLL_ELIGIBLE_STATUSES: readonly InternalPayoutStatus[] = ['submitted', 'processing', 'unknown'];

export function isEligibleForScheduledPoll(status: string): boolean {
  return (SCHEDULED_POLL_ELIGIBLE_STATUSES as readonly string[]).includes(status);
}

// ── External -> internal mapping ────────────────────────────────────────
// Anything other than the literal, documented 'COMPLETED' can ever
// resolve to 'successful' — the property that makes "treat ACCEPTED as
// pending, not successful" and "do not mark settlement complete until
// final confirmation" true by construction. An unrecognised/missing
// status (a malformed response, or a genuinely undocumented value) maps
// to 'unknown' — an honest "we don't know" signal, distinct from
// 'processing' ("we know Selcom is still working on it").
export type MappedPayoutStatus = 'processing' | 'successful' | 'failed' | 'unknown';

export function mapSelcomTransactionStatus(selcomStatus: string | null | undefined): MappedPayoutStatus {
  switch ((selcomStatus ?? '').trim().toUpperCase()) {
    case 'COMPLETED':
      return 'successful';
    case 'FAILED':
      return 'failed';
    case 'ACCEPTED':
      return 'processing';
    default:
      return 'unknown';
  }
}

// ── Controlled backoff schedule for the scheduled status-check poller ──
// Minutes to wait before the NEXT check, indexed by how many checks have
// already been recorded for this payout (status_check_count, post
// this-check). Capped at the last entry for anything beyond — checks
// never get more frequent than this floor, and never stop entirely on
// their own (that's what the expiry window below is for).
export const BACKOFF_SCHEDULE_MINUTES: readonly number[] = [1, 5, 15, 30, 60, 120];

export function getBackoffMinutes(statusCheckCount: number): number {
  const index = Math.min(Math.max(statusCheckCount, 0), BACKOFF_SCHEDULE_MINUTES.length - 1);
  return BACKOFF_SCHEDULE_MINUTES[index];
}

// Default polling window, in hours, before an unresolved payout is moved
// to Manual Review — overridden per-deployment by
// company_settings.payout_status_check_max_hours (see the Administration
// settings page this should eventually be exposed on; the column exists
// today, defaulting to this same value).
export const DEFAULT_STATUS_CHECK_MAX_HOURS = 48;
