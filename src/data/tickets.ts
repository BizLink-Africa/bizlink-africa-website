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
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_client', label: 'Waiting Client' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number]['value'];

export interface Ticket {
  id: string;
  client_id: string | null;
  title: string;
  category: TicketCategory;
  priority: string;
  status: TicketStatus;
  assigned_staff: string | null;
  created_at: string;
  updated_at: string;
}
