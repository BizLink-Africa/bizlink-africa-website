import { verifyAdminSession, getUserPermissions } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { getSidebarBadgeCounts } from '@/lib/dashboard/badge-adapters';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await verifyAdminSession();

  const supabase = await createClient();
  const [{ data: staffProfile }, permissions, badgeCounts] = await Promise.all([
    supabase.from('staff_profiles').select('role').eq('user_id', user.id).maybeSingle(),
    getUserPermissions(),
    getSidebarBadgeCounts(supabase),
  ]);

  let roleLabel = 'Staff';
  if (staffProfile?.role) {
    const { data: roleRow } = await supabase.from('roles').select('name').eq('id', staffProfile.role).maybeSingle();
    roleLabel = roleRow?.name ?? staffProfile.role;
  }

  return (
    <div className="min-h-screen bg-[#f5f3f3] flex flex-col lg:flex-row">
      <AdminSidebar
        roleLabel={roleLabel}
        email={user.email ?? ''}
        permissions={Array.from(permissions)}
        badgeCounts={badgeCounts}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <main className="px-6 md:px-10 py-8 flex-1 w-full min-w-0">{children}</main>
      </div>
    </div>
  );
}
