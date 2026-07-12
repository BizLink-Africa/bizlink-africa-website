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

// Stricter check for actions that must be limited to super_admin — e.g.
// changing another staff member's role. RLS enforces "must be active staff"
// on every table, but can't cheaply distinguish "editing my own role" from
// other updates, so role-escalation is blocked here instead.
export async function requireSuperAdmin() {
  const user = await verifyAdminSession();
  const supabase = await createClient();

  const { data: staff } = await supabase
    .from('staff_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!staff || !staff.is_active || staff.role !== 'super_admin') {
    throw new Error('Only a super admin can perform this action.');
  }

  return user;
}
