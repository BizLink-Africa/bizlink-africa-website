export const API_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'warning', label: 'Warning' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending_setup', label: 'Pending Setup' },
  { value: 'disabled', label: 'Disabled' },
] as const;

export type ApiStatus = (typeof API_STATUSES)[number]['value'];

export const INTEGRATION_TYPES = [
  { value: 'payment_gateway', label: 'Payment Gateway' },
  { value: 'sms_gateway', label: 'SMS Gateway' },
  { value: 'email_provider', label: 'Email Provider' },
  { value: 'ai_agent', label: 'AI Agent' },
  { value: 'social_commerce', label: 'Social Commerce' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'other', label: 'Other' },
] as const;

export type IntegrationType = (typeof INTEGRATION_TYPES)[number]['value'];

export const ENVIRONMENTS = [
  { value: 'production', label: 'Production' },
  { value: 'staging', label: 'Staging' },
  { value: 'sandbox', label: 'Sandbox' },
] as const;

export type Environment = (typeof ENVIRONMENTS)[number]['value'];

export const INCIDENT_STATUSES = [
  { value: 'none', label: 'None' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'identified', label: 'Identified' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'resolved', label: 'Resolved' },
] as const;

export type IntegrationIncidentStatus = (typeof INCIDENT_STATUSES)[number]['value'];

export const WEBHOOK_STATUSES = [
  { value: 'not_configured', label: 'Not Configured' },
  { value: 'active', label: 'Active' },
  { value: 'failing', label: 'Failing' },
  { value: 'disabled', label: 'Disabled' },
] as const;

export type IntegrationWebhookStatus = (typeof WEBHOOK_STATUSES)[number]['value'];

export interface IntegrationHealth {
  id: string;
  client_id: string | null;
  service_type: string;
  integration_type: IntegrationType | null;
  environment: Environment;
  api_status: ApiStatus;
  webhook_endpoint: string | null;
  webhook_status: IntegrationWebhookStatus;
  last_successful_request: string | null;
  last_failed_request: string | null;
  error_message: string | null;
  success_rate_percentage: number | null;
  avg_response_time_ms: number | null;
  technical_owner: string | null;
  incident_status: IntegrationIncidentStatus;
  payment_partner_routing_status: string | null;
  ai_agent_status: string | null;
  social_commerce_bot_status: string | null;
  created_at: string;
  updated_at: string;
}
