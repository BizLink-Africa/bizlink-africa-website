export interface LoginEvent {
  id: string;
  email: string;
  success: boolean;
  ip_address: string | null;
  user_agent: string | null;
  failure_reason: string | null;
  occurred_at: string;
}
