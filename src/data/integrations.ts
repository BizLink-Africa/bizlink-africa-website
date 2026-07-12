export const API_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'warning', label: 'Warning' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending_setup', label: 'Pending Setup' },
  { value: 'disabled', label: 'Disabled' },
] as const;

export type ApiStatus = (typeof API_STATUSES)[number]['value'];

export interface IntegrationHealth {
  id: string;
  client_id: string | null;
  service_type: string;
  api_status: ApiStatus;
  webhook_endpoint: string | null;
  last_successful_request: string | null;
  last_failed_request: string | null;
  error_message: string | null;
  payment_partner_routing_status: string | null;
  ai_agent_status: string | null;
  social_commerce_bot_status: string | null;
  created_at: string;
  updated_at: string;
}
