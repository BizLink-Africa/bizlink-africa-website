// Where each staff role lands immediately after sign-in. Keys are
// staff_profiles.role values (roles.id) — see the 8-role seed in
// supabase/migrations/20260716000000_create_rbac_foundation.sql. Each target
// route is that role's dashboard page (module root), not a sub-page.
export const ROLE_DASHBOARD_ROUTES: Record<string, string> = {
  super_admin: '/admin',
  ceo: '/admin/ceo',
  cfo: '/admin/finance',
  cto: '/admin/cto',
  operations: '/admin/operations',
  customer_support: '/admin/support',
  marketing: '/admin/marketing',
  compliance_security: '/admin/compliance',
};

// Landing page for a role with no dashboard mapping (a future role added to
// the roles table but not yet wired here, or a signed-in user with no
// active staff_profiles row) — the Overview page requires no permission and
// is safe for any authenticated staff member.
export const DEFAULT_DASHBOARD_ROUTE = '/admin';

export function getDashboardRouteForRole(role: string | null | undefined): string {
  if (!role) return DEFAULT_DASHBOARD_ROUTE;
  return ROLE_DASHBOARD_ROUTES[role] ?? DEFAULT_DASHBOARD_ROUTE;
}
