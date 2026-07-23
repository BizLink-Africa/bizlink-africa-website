export const WEBHOOK_DELIVERY_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
  { value: 'retrying', label: 'Retrying' },
] as const;

export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number]['value'];

export interface WebhookDelivery {
  id: string;
  client_id: string | null;
  endpoint: string;
  event: string;
  delivery_status: WebhookDeliveryStatus;
  response_summary: string | null;
  retry_count: number;
  failure_reason: string | null;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
}
