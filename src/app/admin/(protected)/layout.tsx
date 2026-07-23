import { verifyAdminSession, getUserPermissions, getStaffProfile } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { getSidebarBadgeCounts } from '@/lib/dashboard/badge-adapters';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await verifyAdminSession();

  const supabase = await createClient();
  const [staffProfile, permissions, badgeCounts] = await Promise.all([
    getStaffProfile(),
    getUserPermissions(),
    getSidebarBadgeCounts(supabase),
  ]);

  const roleLabel = staffProfile?.roleName ?? staffProfile?.role ?? 'Staff';

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
