export const CONTRACT_REVIEW_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_review', label: 'In Review' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'flagged', label: 'Flagged' },
] as const;

export type ContractReviewStatus = (typeof CONTRACT_REVIEW_STATUSES)[number]['value'];

export const CONTRACT_APPROVAL_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
] as const;

export type ContractApprovalStatus = (typeof CONTRACT_APPROVAL_STATUSES)[number]['value'];

export interface ContractCompliance {
  id: string;
  contract_id: string;
  required_clauses: string[];
  review_status: ContractReviewStatus;
  findings: string | null;
  approval_status: ContractApprovalStatus;
  reviewer: string | null;
  review_date: string | null;
  created_at: string;
  updated_at: string;
}
