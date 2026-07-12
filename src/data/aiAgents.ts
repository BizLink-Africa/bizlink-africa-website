export const AGENT_TYPES = [
  { value: 'sales_agent', label: 'AI Sales Agent' },
  { value: 'customer_care_agent', label: 'AI Customer Care Agent' },
] as const;

export type AgentType = (typeof AGENT_TYPES)[number]['value'];

export const AGENT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'warning', label: 'Warning' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending_setup', label: 'Pending Setup' },
  { value: 'disabled', label: 'Disabled' },
] as const;

export type AgentStatus = (typeof AGENT_STATUSES)[number]['value'];

export const KNOWLEDGE_BASE_STATUSES = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'ready', label: 'Ready' },
] as const;

export type KnowledgeBaseStatus = (typeof KNOWLEDGE_BASE_STATUSES)[number]['value'];

export interface AiAgentConfig {
  id: string;
  client_id: string;
  agent_type: AgentType;
  agent_status: AgentStatus;
  business_hours: string | null;
  knowledge_base_status: KnowledgeBaseStatus;
  products_configured: boolean;
  human_handover_contact: string | null;
  created_at: string;
  updated_at: string;
}
