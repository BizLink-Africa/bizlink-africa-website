export const OPPORTUNITY_STAGES = [
  { value: 'identified', label: 'Identified' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'solution_proposed', label: 'Solution Proposed' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'verbal_agreement', label: 'Verbal Agreement' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'on_hold', label: 'On Hold' },
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number]['value'];

export const OPEN_OPPORTUNITY_STAGES: OpportunityStage[] = OPPORTUNITY_STAGES.map((s) => s.value).filter(
  (v) => v !== 'won' && v !== 'lost'
);

export interface Opportunity {
  id: string;
  opportunity_number: string;
  name: string;
  client_id: string | null;
  lead_id: string | null;
  related_service: string | null;
  estimated_value: number;
  currency: string;
  probability: number;
  stage: OpportunityStage;
  expected_close_date: string | null;
  owner_user_id: string | null;
  competitor_notes: string | null;
  next_action: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const PROPOSAL_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
  { value: 'converted', label: 'Converted' },
] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]['value'];

export interface Proposal {
  id: string;
  proposal_number: string;
  lead_id: string | null;
  client_id: string | null;
  services: string[];
  scope: string | null;
  pricing_summary_total: number;
  currency: string;
  pricing_notes: string | null;
  valid_until: string | null;
  status: ProposalStatus;
  created_by: string | null;
  approved_by: string | null;
  sent_date: string | null;
  client_response: string | null;
  related_proforma_id: string | null;
  related_contract_id: string | null;
  current_version: number;
  created_at: string;
  updated_at: string;
}

export interface ProposalVersion {
  id: string;
  proposal_id: string;
  version_number: number;
  file_path: string;
  file_name: string;
  uploaded_by: string | null;
  created_at: string;
}

export const COMMUNICATION_TYPES = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'other', label: 'Other' },
] as const;

export type CommunicationType = (typeof COMMUNICATION_TYPES)[number]['value'];

export const FOLLOW_UP_STATUSES = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number]['value'];

export interface CrmFollowUp {
  id: string;
  follow_up_date: string;
  lead_id: string | null;
  client_id: string | null;
  assigned_user_id: string | null;
  communication_type: CommunicationType;
  purpose: string | null;
  result: string | null;
  next_action: string | null;
  status: FollowUpStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientContact {
  id: string;
  client_id: string;
  full_name: string;
  role_title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function labelFor<T extends { value: string; label: string }>(list: readonly T[], value: string): string {
  return list.find((item) => item.value === value)?.label ?? value;
}
