export const APPROVAL_CATEGORIES = [
  { value: 'contracts', label: 'Contracts' },
  { value: 'proformas', label: 'Proformas' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'access_requests', label: 'Access Requests' },
  { value: 'policies', label: 'Policies' },
  { value: 'high_risk_operations', label: 'High-Risk Operations' },
] as const;

export type ApprovalCategory = (typeof APPROVAL_CATEGORIES)[number]['value'];

export const APPROVAL_REQUEST_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
] as const;

export type ApprovalRequestStatus = (typeof APPROVAL_REQUEST_STATUSES)[number]['value'];

export function labelFor<T extends { value: string; label: string }>(list: readonly T[], value: string): string {
  return list.find((item) => item.value === value)?.label ?? value;
}

export interface ApprovalWorkflow {
  id: string;
  name: string;
  category: ApprovalCategory;
  description: string | null;
  approver_role: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRequest {
  id: string;
  workflow_id: string | null;
  category: ApprovalCategory;
  subject_label: string;
  amount: number | null;
  requested_by: string;
  status: ApprovalRequestStatus;
  decision_notes: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}
