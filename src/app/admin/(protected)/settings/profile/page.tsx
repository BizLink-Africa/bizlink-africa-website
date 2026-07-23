import { verifyAdminSession } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import ChangePasswordForm from '@/components/admin/ChangePasswordForm';

export const dynamic = 'force-dynamic';

interface StaffProfileRow {
  full_name: string;
  email: string;
  role: string;
  department: string | null;
  mfa_enabled: boolean;
  is_active: boolean;
}

export default async function ProfilePage() {
  const user = await verifyAdminSession();
  const supabase = await createClient();

  const { data: staff } = await supabase
    .from('staff_profiles')
    .select('full_name, email, role, department, mfa_enabled, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  const profile = staff as StaffProfileRow | null;
  let roleName = profile?.role ?? '—';
  if (profile?.role) {
    const { data: role } = await supabase.from('roles').select('name').eq('id', profile.role).maybeSingle();
    roleName = role?.name ?? profile.role;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Profile</h1>
        <p className="text-sm text-[#707975] mt-1">Your own account details. Role, department, and MFA status are managed by a Super Admin on Staff & Roles.</p>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 space-y-2 text-sm text-[#3f4945]">
        <p><span className="font-semibold text-[#707975]">Full Name:</span> {profile?.full_name ?? '—'}</p>
        <p><span className="font-semibold text-[#707975]">Email:</span> {profile?.email ?? user.email}</p>
        <p><span className="font-semibold text-[#707975]">Role:</span> {roleName}</p>
        <p><span className="font-semibold text-[#707975]">Department:</span> {profile?.department ?? 'Unassigned'}</p>
        <p><span className="font-semibold text-[#707975]">MFA:</span> {profile?.mfa_enabled ? 'Enabled' : 'Disabled'}</p>
        <p><span className="font-semibold text-[#707975]">Account Status:</span> {profile?.is_active ? 'Active' : 'Inactive'}</p>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 space-y-4">
        <h2 className="font-semibold text-[#00342b]">Change Password</h2>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
