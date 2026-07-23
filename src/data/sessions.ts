export interface UserSession {
  id: string;
  staff_id: string;
  device: string | null;
  ip_address: string | null;
  login_at: string;
  last_active_at: string;
  revoked: boolean;
  revoked_by: string | null;
  revoked_at: string | null;
  created_at: string;
}
