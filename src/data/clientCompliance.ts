export const CLIENT_COMPLIANCE_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'compliant', label: 'Compliant' },
  { value: 'non_compliant', label: 'Non-Compliant' },
  { value: 'under_review', label: 'Under Review' },
] as const;

export type ClientComplianceStatus = (typeof CLIENT_COMPLIANCE_STATUSES)[number]['value'];

export interface ClientCompliance {
  id: string;
  client_id: string;
  compliance_status: ClientComplianceStatus;
  documents_received: string[];
  documents_pending: string[];
  review_date: string | null;
  next_review_date: string | null;
  risk_level: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
