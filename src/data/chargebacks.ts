export const CHARGEBACK_CASE_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'evidence_requested', label: 'Evidence Requested' },
  { value: 'evidence_submitted', label: 'Evidence Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'closed', label: 'Closed' },
] as const;

export type ChargebackCaseStatus = (typeof CHARGEBACK_CASE_STATUSES)[number]['value'];

export const CHARGEBACK_CASE_STATUS_COLORS: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800',
  evidence_requested: 'bg-blue-100 text-blue-800',
  evidence_submitted: 'bg-indigo-100 text-indigo-800',
  under_review: 'bg-purple-100 text-purple-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-700',
  withdrawn: 'bg-orange-100 text-orange-800',
  closed: 'bg-[#efeded] text-[#707975]',
};

export const CHARGEBACK_REASONS = [
  { value: 'fraud', label: 'Fraud' },
  { value: 'duplicate', label: 'Duplicate Transaction' },
  { value: 'product_not_received', label: 'Product Not Received' },
  { value: 'product_unacceptable', label: 'Product Unacceptable' },
  { value: 'subscription_cancelled', label: 'Subscription Cancelled' },
  { value: 'credit_not_processed', label: 'Credit Not Processed' },
  { value: 'unrecognized', label: 'Unrecognized Transaction' },
  { value: 'other', label: 'Other' },
] as const;

export const CHARGEBACK_EVIDENCE_STATUSES = [
  { value: 'not_required', label: 'Not Required' },
  { value: 'pending', label: 'Pending' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'overdue', label: 'Overdue' },
] as const;

export const CHARGEBACK_RECOVERY_STATUSES = [
  { value: 'not_applicable', label: 'Not Applicable' },
  { value: 'pending', label: 'Pending' },
  { value: 'partially_recovered', label: 'Partially Recovered' },
  { value: 'recovered', label: 'Recovered' },
  { value: 'unrecoverable', label: 'Unrecoverable' },
] as const;

// 'settlement_deduction' was removed as a selectable recovery method:
// BizLink Africa does not receive, hold, reconcile, disburse or settle
// merchant funds, so there is no settlement to deduct a recovery from.
// Historical records with that value are untouched and still display
// correctly — see recordChargebackRecovery() in
// src/app/admin/(protected)/chargebacks/actions.ts, which rejects any new
// attempt to use it.
export const CHARGEBACK_RECOVERY_METHODS = [
  { value: 'manual_invoice', label: 'Manual Invoice' },
  { value: 'other', label: 'Other' },
] as const;

export const CHARGEBACK_EVIDENCE_TYPES = [
  { value: 'proof_of_delivery', label: 'Proof of Delivery' },
  { value: 'customer_communication', label: 'Customer Communication' },
  { value: 'receipt_or_invoice', label: 'Receipt or Invoice' },
  { value: 'refund_policy', label: 'Refund Policy' },
  { value: 'signed_agreement', label: 'Signed Agreement' },
  { value: 'service_usage_log', label: 'Service Usage Log' },
  { value: 'other', label: 'Other' },
] as const;

export const CHARGEBACK_EVIDENCE_ITEM_STATUSES = [
  { value: 'requested', label: 'Requested' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'not_applicable', label: 'Not Applicable' },
] as const;

export const CHARGEBACK_CASE_EVENT_LABELS: Record<string, string> = {
  opened: 'Case Opened',
  evidence_requested: 'Evidence Requested',
  evidence_submitted: 'Evidence Submitted',
  under_review: 'Moved to Under Review',
  resolved_won: 'Resolved — Won',
  resolved_lost: 'Resolved — Lost',
  resolved_withdrawn: 'Resolved — Withdrawn',
  recovery_recorded: 'Recovery Recorded',
  closed: 'Case Closed',
};

export interface ChargebackCase {
  id: string;
  case_reference: string;
  original_transaction_id: string;
  merchant_id: string;
  disputed_amount: string;
  associated_fee: string;
  reason: string;
  evidence_due_at: string | null;
  evidence_status: string;
  case_status: ChargebackCaseStatus;
  outcome: 'won' | 'lost' | 'withdrawn' | null;
  recovery_status: string;
  recovery_amount: string | null;
  recovery_method: string | null;
  recovery_notes: string | null;
  recovery_recorded_by: string | null;
  recovery_recorded_at: string | null;
  opened_by: string;
  opened_at: string;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface ChargebackCaseEvent {
  id: string;
  case_id: string;
  event_type: string;
  performed_by: string;
  performed_at: string;
  notes: string | null;
}

export interface ChargebackEvidenceItem {
  id: string;
  case_id: string;
  evidence_type: string;
  status: string;
  notes: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  created_at: string;
}
