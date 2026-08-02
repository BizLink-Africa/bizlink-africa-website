export const SETTLEMENT_BATCH_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'reconciliation_pending', label: 'Reconciliation Pending' },
  { value: 'ready_for_review', label: 'Ready for Review' },
  { value: 'ready_for_approval', label: 'Ready for Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'processing', label: 'Processing' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export type SettlementBatchStatus = (typeof SETTLEMENT_BATCH_STATUSES)[number]['value'];

export const SETTLEMENT_BATCH_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  reconciliation_pending: 'bg-amber-100 text-amber-800',
  ready_for_review: 'bg-blue-100 text-blue-800',
  ready_for_approval: 'bg-indigo-100 text-indigo-800',
  approved: 'bg-teal-100 text-teal-800',
  processing: 'bg-purple-100 text-purple-800',
  partially_paid: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-[#efeded] text-[#707975]',
};

export const PAYOUT_LINE_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
] as const;

export type PayoutLineStatus = (typeof PAYOUT_LINE_STATUSES)[number]['value'];

// Human-readable labels for the 12 pre-settlement check codes recorded on
// settlement_batch_exclusions.failed_checks — used to explain to Finance
// exactly why a merchant/transaction was left out of a batch.
export const PRE_SETTLEMENT_CHECK_LABELS: Record<string, string> = {
  kyc_confirmed: 'KYC confirmed',
  merchant_active: 'Merchant active',
  till_active: 'Till active',
  merchant_agreement_accepted: 'Merchant agreement accepted',
  beneficiary_verified: 'Beneficiary verified',
  cooling_period_passed: 'Cooling period passed',
  transactions_reconciled: 'Transactions reconciled',
  no_chargeback_hold: 'No chargeback hold',
  sufficient_cleared_amount: 'Sufficient cleared amount',
  commission_rule_valid: 'Commission rule valid',
};

export interface SettlementBatch {
  id: string;
  batch_number: string;
  settlement_date: string;

  merchant_count: number;
  transaction_count: number;

  gross_collection_total: string;
  provider_fee_total: string;
  bizlink_commission_total: string;
  adjustment_total: string;
  chargeback_hold_total: string;
  merchant_net_total: string;

  received_vendor_account_amount: string | null;
  unresolved_variance: string;
  variance_authorised_by: string | null;
  variance_authorised_at: string | null;
  variance_resolution_notes: string | null;

  requires_dual_approval: boolean;

  status: SettlementBatchStatus;

  prepared_by: string | null;
  prepared_at: string | null;
  submitted_at: string | null;

  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;

  approved_by: string | null;
  approved_at: string | null;
  approval_notes: string | null;
  second_approved_by: string | null;
  second_approved_at: string | null;

  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;

  compliance_hold: boolean;
  compliance_hold_by: string | null;
  compliance_hold_at: string | null;
  compliance_hold_reason: string | null;
  compliance_hold_released_by: string | null;
  compliance_hold_released_at: string | null;

  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;

  completed_at: string | null;
  created_at: string;
}

export interface SettlementBatchLine {
  id: string;
  batch_id: string;
  merchant_id: string;
  transaction_count: number;
  gross_amount: string;
  provider_fee: string;
  bizlink_commission: string;
  adjustment_total: string;
  chargeback_hold: string;
  net_amount: string;
  beneficiary_id: string | null;
  payout_status: PayoutLineStatus;
  payout_reference: string | null;
  payout_attempted_at: string | null;
  payout_completed_at: string | null;
  payout_failure_reason: string | null;
}

export interface SettlementBatchExclusion {
  id: string;
  batch_id: string;
  merchant_id: string | null;
  transaction_id: string | null;
  failed_checks: string[];
  created_at: string;
}

export interface SettlementBatchEvent {
  id: string;
  batch_id: string;
  event_type: string;
  performed_by: string;
  performed_at: string;
  notes: string | null;
}
