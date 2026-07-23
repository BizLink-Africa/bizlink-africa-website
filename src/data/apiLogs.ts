export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const ERROR_CATEGORIES = [
  { value: 'none', label: 'None' },
  { value: 'validation', label: 'Validation' },
  { value: 'authentication', label: 'Authentication' },
  { value: 'rate_limit', label: 'Rate Limit' },
  { value: 'upstream', label: 'Upstream' },
  { value: 'timeout', label: 'Timeout' },
  { value: 'server_error', label: 'Server Error' },
] as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[number]['value'];

export interface ApiRequestLog {
  id: string;
  occurred_at: string;
  client_id: string | null;
  endpoint: string;
  method: HttpMethod;
  response_code: number;
  response_time_ms: number | null;
  correlation_id: string | null;
  error_category: ErrorCategory;
  retry_count: number;
  environment: string;
  created_at: string;
}
