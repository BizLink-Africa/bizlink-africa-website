export const TICKET_CATEGORIES = [
  { value: 'technical', label: 'Technical' },
  { value: 'integration', label: 'Integration' },
  { value: 'ai_agent', label: 'AI Agent' },
  { value: 'social_commerce', label: 'Social Commerce' },
  { value: 'payment_integration_support', label: 'Payment Integration Support' },
  { value: 'website', label: 'Website' },
  { value: 'other', label: 'Other' },
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number]['value'];

export const TICKET_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_client', label: 'Waiting for Client' },
  { value: 'waiting_internal', label: 'Waiting for Internal Team' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'reopened', label: 'Reopened' },
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number]['value'];

// Statuses that count as "still needs work" for KPI/badge purposes.
export const OPEN_TICKET_STATUSES: TicketStatus[] = [
  'new', 'open', 'in_progress', 'waiting_client', 'waiting_internal', 'escalated', 'reopened',
];

export const DEPARTMENTS = [
  { value: 'operations', label: 'Operations' },
  { value: 'technology', label: 'Technology' },
  { value: 'finance', label: 'Finance' },
  { value: 'compliance_security', label: 'Compliance & Security' },
  { value: 'executive', label: 'Executive' },
  { value: 'customer_support', label: 'Customer Support' },
] as const;

export type Department = (typeof DEPARTMENTS)[number]['value'];

export const ESCALATION_TARGETS = [
  { value: 'operations', label: 'Operations' },
  { value: 'cto', label: 'CTO' },
  { value: 'cfo', label: 'CFO (Billing Issues)' },
  { value: 'compliance_security', label: 'Compliance & Security' },
  { value: 'ceo', label: 'CEO (Critical Executive Issues)' },
] as const;

export type EscalationTarget = (typeof ESCALATION_TARGETS)[number]['value'];

export function labelFor<T extends { value: string; label: string }>(list: readonly T[], value: string): string {
  return list.find((item) => item.value === value)?.label ?? value;
}

export interface Ticket {
  id: string;
  ticket_number: string | null;
  client_id: string | null;
  title: string;
  description: string | null;
  contact_person: string | null;
  contact_email: string | null;
  category: TicketCategory;
  priority: string;
  status: TicketStatus;
  assigned_staff: string | null;
  assigned_user_id: string | null;
  department: Department | null;
  related_service_id: string | null;
  related_integration_id: string | null;
  related_ai_agent_id: string | null;
  escalated_to: EscalationTarget | null;
  escalation_reason: string | null;
  escalated_at: string | null;
  response_deadline: string | null;
  resolution_deadline: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  reopened_count: number;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  author: string;
  message: string;
  is_internal: boolean;
  staff_user_id: string | null;
  created_at: string;
}

export interface TicketAttachment {
  id: string;
  message_id: string;
  file_path: string;
  file_name: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface SlaRule {
  priority: string;
  response_hours: number;
  resolution_hours: number;
  updated_at: string;
}

export type SlaState = 'on_track' | 'due_soon' | 'breached' | 'met';

const DUE_SOON_WINDOW_HOURS = 2;

// Computed live, never stored — same idiom as computeExpiryFlag/daysOverdue
// in data/finance.ts. A deadline is only ever "breached"/"due_soon" while
// the thing it measures hasn't happened yet (no first response / not
// resolved); once it has, the deadline is "met" regardless of the clock.
export function computeSlaState(deadline: string | null, achievedAt: string | null, now: Date = new Date()): SlaState | null {
  if (!deadline) return null;
  if (achievedAt) return new Date(achievedAt) <= new Date(deadline) ? 'met' : 'breached';
  const deadlineMs = new Date(deadline).getTime();
  const nowMs = now.getTime();
  if (nowMs > deadlineMs) return 'breached';
  if (deadlineMs - nowMs <= DUE_SOON_WINDOW_HOURS * 60 * 60 * 1000) return 'due_soon';
  return 'on_track';
}

export const KB_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
] as const;

export type KbStatus = (typeof KB_STATUSES)[number]['value'];

export const KB_VISIBILITY = [
  { value: 'internal', label: 'Internal Only' },
  { value: 'client_visible', label: 'Client-Visible' },
] as const;

export type KbVisibility = (typeof KB_VISIBILITY)[number]['value'];

export interface KbCategory {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface KbArticle {
  id: string;
  category_id: string | null;
  title: string;
  content: string;
  status: KbStatus;
  visibility: KbVisibility;
  related_categories: TicketCategory[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CsatEntry {
  id: string;
  ticket_id: string;
  client_id: string | null;
  agent_user_id: string | null;
  rating: number;
  feedback: string | null;
  created_by: string | null;
  created_at: string;
}
