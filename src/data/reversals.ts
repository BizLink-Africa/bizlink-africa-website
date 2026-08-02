export const MANUAL_REVERSAL_STATUSES = [
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'completed', label: 'Completed' },
] as const;

export type ManualReversalStatus = (typeof MANUAL_REVERSAL_STATUSES)[number]['value'];

export const MANUAL_REVERSAL_STATUS_COLORS: Record<string, string> = {
  pending_approval: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-700',
  completed: 'bg-green-100 text-green-800',
};

export interface ManualReversalRequest {
  id: string;
  transaction_id: string;
  merchant_id: string;
  reversal_amount: string;
  reason: string;
  linked_chargeback_case_id: string | null;
  status: ManualReversalStatus;
  requested_by: string;
  requested_at: string;
  approved_by: string | null;
  approved_at: string | null;
  review_notes: string | null;
  completed_at: string | null;
  created_at: string;
}
