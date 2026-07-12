import { createClient } from '@/lib/supabase/server';
import { STAFF_ROLES, type Staff } from '@/data/staff';
import AddStaffForm from '@/components/admin/AddStaffForm';
import InlineSelect from '@/components/admin/InlineSelect';
import StaffActiveToggle from '@/components/admin/StaffActiveToggle';
import { updateStaffRole } from './actions';

export const dynamic = 'force-dynamic';

function countByName(rows: Array<{ name: string | null }>, name: string): number {
  return rows.filter((row) => row.name?.trim().toLowerCase() === name.trim().toLowerCase()).length;
}

export default async function StaffPage() {
  const supabase = await createClient();

  const [{ data: staff, error }, { data: leads }, { data: tickets }] = await Promise.all([
    supabase.from('staff_profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('website_leads').select('assigned_to'),
    supabase.from('support_tickets').select('assigned_staff'),
  ]);

  const staffList = (staff ?? []) as Staff[];
  const leadRows = (leads ?? []).map((l) => ({ name: l.assigned_to as string | null }));
  const ticketRows = (tickets ?? []).map((t) => ({ name: t.assigned_staff as string | null }));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-[Geist,sans-serif] font-bold text-2xl text-[#00342b]">Staff & Roles</h1>
          <p className="text-sm text-[#707975] mt-1">
            {staffList.length} staff member{staffList.length === 1 ? '' : 's'}. Assigned counts match by name against
            the free-text &quot;assigned&quot; fields on leads and tickets.
          </p>
        </div>
        <AddStaffForm />
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load staff: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Assigned Leads</th>
              <th className="px-4 py-3">Assigned Tickets</th>
              <th className="px-4 py-3">Account Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map((member) => (
              <tr key={member.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">{member.full_name}</td>
                <td className="px-4 py-3 text-[#3f4945]">{member.email}</td>
                <td className="px-4 py-3">
                  <InlineSelect
                    value={member.role}
                    options={STAFF_ROLES}
                    onSave={updateStaffRole.bind(null, member.id)}
                  />
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{countByName(leadRows, member.full_name)}</td>
                <td className="px-4 py-3 text-[#3f4945]">{countByName(ticketRows, member.full_name)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${member.is_active ? 'bg-[#dcf5e3] text-[#1b7a3d]' : 'bg-[#eeeeee] text-[#3f4945]'}`}>
                    {member.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StaffActiveToggle id={member.id} isActive={member.is_active} />
                </td>
              </tr>
            ))}
            {staffList.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No staff members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
