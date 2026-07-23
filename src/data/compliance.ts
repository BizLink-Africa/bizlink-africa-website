export const COMPLIANCE_CATEGORIES = [
  { value: 'kyc', label: 'KYC' },
  { value: 'license', label: 'License' },
  { value: 'data_protection', label: 'Data Protection' },
  { value: 'contract', label: 'Contract' },
  { value: 'regulatory', label: 'Regulatory' },
  { value: 'other', label: 'Other' },
] as const;

export type ComplianceCategory = (typeof COMPLIANCE_CATEGORIES)[number]['value'];

export const COMPLIANCE_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_review', label: 'In Review' },
  { value: 'compliant', label: 'Compliant' },
  { value: 'non_compliant', label: 'Non-Compliant' },
  { value: 'remediation_required', label: 'Remediation Required' },
] as const;

export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number]['value'];

export const RISK_LEVELS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number]['value'];

export const SECURITY_EVENT_TYPES = [
  { value: 'login_failure', label: 'Login Failure' },
  { value: 'permission_change', label: 'Permission Change' },
  { value: 'suspicious_activity', label: 'Suspicious Activity' },
  { value: 'data_export', label: 'Data Export' },
  { value: 'access_review', label: 'Access Review' },
  { value: 'other', label: 'Other' },
] as const;

export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number]['value'];

export const SECURITY_SEVERITIES = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
] as const;

export type SecuritySeverity = (typeof SECURITY_SEVERITIES)[number]['value'];

export const SECURITY_EVENT_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'false_positive', label: 'False Positive' },
] as const;

export type SecurityEventStatus = (typeof SECURITY_EVENT_STATUSES)[number]['value'];

export function labelFor<T extends { value: string; label: string }>(list: readonly T[], value: string): string {
  return list.find((item) => item.value === value)?.label ?? value;
}

export interface ComplianceReview {
  id: string;
  review_number: string | null;
  title: string;
  category: ComplianceCategory;
  related_client_id: string | null;
  department: string | null;
  status: ComplianceStatus;
  reviewer: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_date: string | null;
  findings: string | null;
  risk_level: RiskLevel | null;
  corrective_actions: string | null;
  corrective_action_due_date: string | null;
  evidence: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SecurityEvent {
  id: string;
  event_type: SecurityEventType;
  severity: SecuritySeverity;
  description: string;
  actor: string | null;
  ip_address: string | null;
  device: string | null;
  result: string | null;
  status: SecurityEventStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
