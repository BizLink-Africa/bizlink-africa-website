// Collection Ledger and Daily Reconciliation catalog. Money fields on the
// interfaces below are typed as `string` deliberately (Postgres
// numeric(14,2) values) — never `number` — so nothing in the app layer is
// tempted to do float arithmetic on them. See src/lib/collections/money.ts.

export const COLLECTION_TRANSACTION_STATUSES = [
  { value: 'successful', label: 'Successful' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
] as const;

export const COLLECTION_RECONCILIATION_STATUSES = [
  { value: 'matched', label: 'Matched' },
  { value: 'partially_matched', label: 'Partially Matched' },
  { value: 'unmatched', label: 'Unmatched' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'reversed', label: 'Reversed' },
  { value: 'under_review', label: 'Under Review' },
] as const;

export const COLLECTION_RECONCILIATION_STATUS_COLORS: Record<string, string> = {
  matched: 'bg-[#dcf5e3] text-[#1b7a3d]',
  partially_matched: 'bg-[#fef3e0] text-[#8a5a00]',
  unmatched: 'bg-[#eeeeee] text-[#3f4945]',
  duplicate: 'bg-[#fbe4e4] text-[#8a1f1f]',
  reversed: 'bg-[#fbe4e4] text-[#8a1f1f]',
  under_review: 'bg-[#fef3e0] text-[#8a5a00]',
};

export const UNRESOLVED_RECONCILIATION_STATUSES = ['unmatched', 'partially_matched', 'under_review', 'duplicate'];

export const COLLECTION_REVERSAL_STATUSES = [
  { value: 'none', label: 'None' },
  { value: 'reversed', label: 'Reversed' },
  { value: 'pending_reversal', label: 'Pending Reversal' },
] as const;

export const COLLECTION_CHARGEBACK_STATUSES = [
  { value: 'none', label: 'None' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'chargeback_confirmed', label: 'Chargeback Confirmed' },
] as const;

export const RECONCILIATION_RUN_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
] as const;

export const RECONCILIATION_RUN_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-[#eeeeee] text-[#3f4945]',
  under_review: 'bg-[#fef3e0] text-[#8a5a00]',
  approved: 'bg-[#dcf5e3] text-[#1b7a3d]',
};

export const MANUAL_ADJUSTMENT_STATUS_COLORS: Record<string, string> = {
  pending_approval: 'bg-[#fef3e0] text-[#8a5a00]',
  approved: 'bg-[#dcf5e3] text-[#1b7a3d]',
  rejected: 'bg-[#fbe4e4] text-[#8a1f1f]',
};

export interface CollectionTransaction {
  id: string;
  provider_transaction_reference: string;
  merchant_id: string | null;
  till_reference: string | null;
  payer_reference_masked: string | null;
  gross_amount: string;
  currency: string;
  provider_fee: string;
  bizlink_commission: string;
  other_authorised_adjustment: string;
  net_merchant_amount: string;
  transaction_status: string;
  reconciliation_status: string;
  settlement_eligibility: boolean;
  collected_at: string;
  imported_at: string;
  source_file_reference: string | null;
  import_batch_id: string | null;
  reversal_status: string;
  chargeback_status: string;
  duplicate_of_transaction_id: string | null;
  reconciliation_run_id: string | null;
  created_by: string;
  created_at: string;
}

export interface CollectionImportBatch {
  id: string;
  source_file_reference: string;
  provider_name: string;
  mode: string;
  row_count: number;
  imported_by: string;
  imported_at: string;
  notes: string | null;
}

export interface CollectionReconciliationRun {
  id: string;
  from_date: string;
  to_date: string;
  till_reference: string | null;
  merchant_id: string | null;
  vendor_amount_received: string | null;
  total_gross: string;
  total_provider_fees: string;
  total_bizlink_commission: string;
  total_net_merchant: string;
  total_reversals: string;
  total_chargebacks: string;
  matched_count: number;
  unresolved_count: number;
  variance: string;
  status: string;
  created_by: string;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
  approval_notes: string | null;
}

export interface CollectionManualAdjustment {
  id: string;
  transaction_id: string;
  adjustment_amount: string;
  reason: string;
  status: string;
  requested_by: string;
  requested_at: string;
  approved_by: string | null;
  approved_at: string | null;
  review_notes: string | null;
}
