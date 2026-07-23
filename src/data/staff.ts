// Roles and their permissions are database-driven (see the `roles`,
// `permissions`, and `role_permissions` tables, and requirePermission() /
// getUserPermissions() in src/lib/supabase/dal.ts) — not hardcoded here.
// New roles can be added by inserting a row into `roles`, without touching
// application code. `role` is a plain string (the role's id/slug) rather
// than a fixed union for the same reason.

export interface RoleOption {
  value: string;
  label: string;
}

export interface Staff {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  role: string;
  department: string | null;
  is_active: boolean;
  mfa_enabled: boolean;
  created_at: string;
  updated_at: string;
}
