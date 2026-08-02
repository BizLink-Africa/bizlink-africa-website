// Full internal lifecycle. 'draft' exists for completeness (no current
// creation path uses it — every payout is created directly in
// 'pending_approval' via create_merchant_payouts_for_batch()) and
// 'unknown'/'manual_review' are produced only by the Selcom status-check
// service — see src/lib/payouts/selcom-status-mapping.ts, the single
// central place that decides what a Selcom status means and which
// internal statuses exist at all. This list must stay in sync with that
// file's INTERNAL_PAYOUT_STATUSES.
export const MERCHANT_PAYOUT_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'processing', label: 'Processing' },
  { value: 'successful', label: 'Successful' },
  { value: 'failed', label: 'Failed' },
  { value: 'unknown', label: 'Unknown' },
  { value: 'manual_review', label: 'Manual Review' },
  { value: 'reversed', label: 'Reversed' },
  { value: 'held', label: 'Held' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export type MerchantPayoutStatus = (typeof MERCHANT_PAYOUT_STATUSES)[number]['value'];

export const MERCHANT_PAYOUT_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-[#efeded] text-[#707975]',
  pending_approval: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  submitted: 'bg-indigo-100 text-indigo-800',
  processing: 'bg-purple-100 text-purple-800',
  successful: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-700',
  unknown: 'bg-[#fef3e0] text-[#8a5a00]',
  manual_review: 'bg-[#fef3e0] text-[#8a5a00]',
  reversed: 'bg-orange-100 text-orange-800',
  held: 'bg-[#fbdada] text-red-800',
  cancelled: 'bg-[#efeded] text-[#707975]',
};

export const MERCHANT_PAYOUT_EVENT_LABELS: Record<string, string> = {
  requested: 'Payout Requested',
  approved: 'Approved',
  cancelled: 'Cancelled',
  submitted: 'Submitted to Adapter',
  result_processing: 'Provider Reported Processing',
  result_successful: 'Provider Reported Successful',
  result_failed: 'Provider Reported Failed',
  result_unknown: 'Provider Reported Unrecognised Status',
  status_check_processing: 'Status Check: Processing',
  status_check_successful: 'Status Check: Successful',
  status_check_failed: 'Status Check: Failed',
  status_check_unknown: 'Status Check: Unrecognised Status',
  moved_to_manual_review: 'Moved to Manual Review',
  callback_success: 'Selcom Callback: Confirmed Successful',
  retried: 'Retried',
  held: 'Placed on Hold',
  hold_released: 'Hold Released',
  reversed: 'Reversed',
};

export interface MerchantPayout {
  id: string;
  payout_reference: string;
  batch_id: string;
  settlement_batch_line_id: string;
  merchant_id: string;
  beneficiary_id: string | null;
  destination_type: 'bank_account' | 'mobile_wallet' | null;

  amount: string;
  currency: string;

  idempotency_key: string;
  provider_payout_reference: string | null;

  // Set once a submission has actually been attempted against Selcom —
  // see src/lib/payouts/selcom-disbursement-adapter.ts and
  // apply_merchant_payout_result(). recipient_name/purpose/remarks are
  // snapshotted at submission time (the beneficiary's on-file name at
  // that moment), not live-joined, so they stay accurate even if the
  // beneficiary record changes later. initial_response is the raw Selcom
  // response envelope — never contains a secret (see the migration
  // header comment on merchant_payouts.initial_response).
  recipient_name: string | null;
  purpose: string | null;
  remarks: string | null;
  initial_response: Record<string, unknown> | null;
  selcom_receipt: string | null;

  status: MerchantPayoutStatus;
  held_from_status: string | null;

  // Selcom status-check scheduling — see
  // src/lib/payouts/status-check-service.ts and selcom-status-mapping.ts.
  last_status_check_at: string | null;
  last_status_check_started_at: string | null;
  status_check_count: number;
  next_status_check_at: string | null;
  status_check_expires_at: string | null;

  failure_code: string | null;
  failure_reason: string | null;
  retry_count: number;

  requested_by: string;
  requested_at: string;

  approved_by: string | null;
  approved_at: string | null;

  submitted_at: string | null;
  completed_at: string | null;

  reversed_by: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;

  held_by: string | null;
  held_at: string | null;
  hold_reason: string | null;
  held_released_by: string | null;
  held_released_at: string | null;

  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;

  created_at: string;
}

export interface MerchantPayoutEvent {
  id: string;
  payout_id: string;
  event_type: string;
  performed_by: string;
  performed_at: string;
  notes: string | null;
}

// One row per Selcom status-query attempt (manual or scheduled) — see
// merchant_payout_status_checks / record_payout_status_check(). Distinct
// from MerchantPayoutEvent: this can be far higher volume (routine
// scheduled polling), so it's rendered as its own history section, not
// mixed into the main lifecycle timeline.
export interface MerchantPayoutStatusCheck {
  id: string;
  payout_id: string;
  trans_id: string;
  trigger_type: 'manual' | 'scheduled';
  performed_by: string;
  started_at: string;
  completed_at: string;
  query_succeeded: boolean;
  http_status: number | null;
  result: string | null;
  resultcode: string | null;
  external_status: string | null;
  mapped_status: string | null;
  status_applied: boolean;
  skip_reason: string | null;
  error_message: string | null;
}

export const MAX_PAYOUT_RETRIES = 3;
