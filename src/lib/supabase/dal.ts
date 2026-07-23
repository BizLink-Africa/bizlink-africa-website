import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Re-verifies the session against Supabase Auth on every call (not just the
// cookie), so this is the "secure" check — safe to gate real data access
// with. Cached per request so multiple calls don't cause duplicate network
// round trips during one render pass.
export const verifyAdminSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/admin/login');
  }

  return user;
});

// Single source of truth for the caller's staff_profiles row (plus their
// role's display name via a join) — cache()'d per request so the layout,
// getUserPermissions(), and anything else that needs it during the same
// render share one query instead of each re-fetching the same row.
export const getStaffProfile = cache(async (): Promise<{
  role: string;
  is_active: boolean;
  roleName: string | null;
} | null> => {
  const user = await verifyAdminSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from('staff_profiles')
    .select('role, is_active, roles(name)')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) return null;

  const roleRow = Array.isArray(data.roles) ? data.roles[0] : data.roles;

  return { role: data.role, is_active: data.is_active, roleName: roleRow?.name ?? null };
});

// Returns the caller's full permission set (role_permissions for their
// staff_profiles.role), or an empty set if they have no active staff row.
// Used for nav filtering and for requirePermission() below. RLS still backs
// every table independently — this is for UI/action gating, not the last
// line of defense (see the protect_staff_role_changes DB trigger for that).
export const getUserPermissions = cache(async (): Promise<Set<string>> => {
  const supabase = await createClient();
  const staff = await getStaffProfile();

  if (!staff || !staff.is_active) {
    return new Set();
  }

  const { data: perms } = await supabase
    .from('role_permissions')
    .select('permission_id')
    .eq('role_id', staff.role);

  return new Set((perms ?? []).map((p) => p.permission_id));
});

// Gate for server actions that require a specific permission (e.g.
// 'roles.manage' to change a staff member's role, 'users.manage' to
// invite/deactivate staff). Throws rather than redirecting, since actions
// call this mid-mutation and expect to handle the failure themselves.
//
// Deliberately does NOT audit-log every denial here: most pages call this
// TWICE (once for `.view` — the real gate — then again for `.manage`, purely
// to decide whether to render the page read-only vs. editable). That second
// call fails for most viewers on purpose and would flood audit_logs with
// noise that isn't a real access-denied event. The one real signal —
// someone hit a page they have no business on — is logged once, at
// <AccessDenied> itself (see components/admin/AccessDenied.tsx), which is
// the thing that actually renders when the PRIMARY `.view` gate fails.
export async function requirePermission(permission: string) {
  const user = await verifyAdminSession();
  const permissions = await getUserPermissions();

  if (!permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }

  return user;
}
