import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import type { Staff, RoleOption } from '@/data/staff';
import { DEPARTMENT_NAMES } from '@/data/departments';
import AddStaffForm from '@/components/admin/AddStaffForm';
import InlineSelect from '@/components/admin/InlineSelect';
import RoleChangeSelect from '@/components/admin/RoleChangeSelect';
import StaffActionsMenu from '@/components/admin/StaffActionsMenu';
import { updateStaffRole, updateStaffDepartment } from './actions';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;
const DEPARTMENT_OPTIONS = [{ value: '', label: 'Unassigned' }, ...DEPARTMENT_NAMES.map((name) => ({ value: name, label: name }))];

interface SearchParams {
  q?: string;
  role?: string;
  department?: string;
  status?: string;
  mfa?: string;
  page?: string;
}

function countByName(rows: Array<{ name: string | null }>, name: string): number {
  return rows.filter((row) => row.name?.trim().toLowerCase() === name.trim().toLowerCase()).length;
}

function countByUserId(rows: Array<{ assigned_user_id: string | null }>, staffId: string): number {
  return rows.filter((row) => row.assigned_user_id === staffId).length;
}

function buildQueryString(params: SearchParams, overrides: Partial<SearchParams>): string {
  const merged = { ...params, ...overrides };
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export default async function StaffPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission('users.view');
  } catch {
    return <AccessDenied requiredPermission="users.view" />;
  }

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase.from('staff_profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (params.q) query = query.or(`full_name.ilike.%${params.q}%,email.ilike.%${params.q}%`);
  if (params.role) query = query.eq('role', params.role);
  if (params.department) query = query.eq('department', params.department);
  if (params.status) query = query.eq('is_active', params.status === 'active');
  if (params.mfa) query = query.eq('mfa_enabled', params.mfa === 'enabled');
  query = query.range(from, to);

  const [{ data: staff, error, count }, { data: leads }, { data: tickets }, { data: roleRows }, { data: logins }] = await Promise.all([
    query,
    supabase.from('website_leads').select('assigned_user_id'),
    supabase.from('support_tickets').select('assigned_staff'),
    supabase.from('roles').select('id, name').eq('is_active', true).order('name'),
    supabase.from('login_events').select('email, occurred_at').eq('success', true).order('occurred_at', { ascending: false }).limit(1000),
  ]);

  const staffList = (staff ?? []) as Staff[];
  const leadRows = (leads ?? []) as { assigned_user_id: string | null }[];
  const ticketRows = (tickets ?? []).map((t) => ({ name: t.assigned_staff as string | null }));
  const roleOptions: RoleOption[] = (roleRows ?? []).map((r) => ({ value: r.id, label: r.name }));

  const lastLoginByEmail = new Map<string, string>();
  for (const row of (logins ?? []) as { email: string; occurred_at: string }[]) {
    if (!lastLoginByEmail.has(row.email)) lastLoginByEmail.set(row.email, row.occurred_at);
  }

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Staff & Roles</h1>
          <p className="text-sm text-[#707975] mt-1">
            {totalCount} staff member{totalCount === 1 ? '' : 's'}. Lead counts use the real assignment link; ticket
            counts still match by name against that table&apos;s free-text &quot;assigned&quot; field.
          </p>
        </div>
        <AddStaffForm roles={roleOptions} />
      </div>

      <form method="GET" className="mb-4 bg-white border border-[#bfc9c4] p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1" htmlFor="q">Search</label>
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Name or email..."
            className="w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1" htmlFor="role">Role</label>
          <select id="role" name="role" defaultValue={params.role ?? ''} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none">
            <option value="">All roles</option>
            {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1" htmlFor="department">Department</label>
          <select id="department" name="department" defaultValue={params.department ?? ''} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none">
            <option value="">All departments</option>
            {DEPARTMENT_NAMES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1" htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={params.status ?? ''} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1" htmlFor="mfa">MFA</label>
          <select id="mfa" name="mfa" defaultValue={params.mfa ?? ''} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none">
            <option value="">All</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        <button type="submit" className="bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors">
          Apply
        </button>
        {(params.q || params.role || params.department || params.status || params.mfa) && (
          <Link href="/admin/staff" className="text-sm text-[#707975] hover:text-[#00342b] px-2 py-2">
            Clear
          </Link>
        )}
      </form>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load staff: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase">
              <th className="px-3 py-2.5 w-[13%]">Name</th>
              <th className="px-3 py-2.5 w-[16%]">Email</th>
              <th className="px-3 py-2.5 w-[13%]">Role</th>
              <th className="px-3 py-2.5 w-[11%]">Department</th>
              <th className="px-3 py-2.5 w-[12%]">Last Login</th>
              <th className="px-3 py-2.5 w-[6%]">Leads</th>
              <th className="px-3 py-2.5 w-[6%]">Tickets</th>
              <th className="px-3 py-2.5 w-[8%]">MFA</th>
              <th className="px-3 py-2.5 w-[9%]">Status</th>
              <th className="px-3 py-2.5 w-[6%]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map((member) => {
              const lastLogin = lastLoginByEmail.get(member.email.toLowerCase());
              return (
                <tr key={member.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                  <td className="px-3 py-2.5 font-medium text-[#1b1c1c] truncate" title={member.full_name}>{member.full_name}</td>
                  <td className="px-3 py-2.5 text-[#3f4945] truncate" title={member.email}>{member.email}</td>
                  <td className="px-3 py-2.5">
                    <RoleChangeSelect
                      value={member.role}
                      options={roleOptions}
                      onSave={updateStaffRole.bind(null, member.id)}
                      className="w-full border border-[#bfc9c4] px-2 py-1 text-xs focus:border-[#00342b] focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <InlineSelect
                      value={member.department ?? ''}
                      options={DEPARTMENT_OPTIONS}
                      onSave={updateStaffDepartment.bind(null, member.id)}
                      className="w-full border border-[#bfc9c4] px-2 py-1 text-xs focus:border-[#00342b] focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[#3f4945]">
                    {lastLogin ? new Date(lastLogin).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'}
                  </td>
                  <td className="px-3 py-2.5 text-[#3f4945]">{countByUserId(leadRows, member.id)}</td>
                  <td className="px-3 py-2.5 text-[#3f4945]">{countByName(ticketRows, member.full_name)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${member.mfa_enabled ? 'bg-[#dcf5e3] text-[#1b7a3d]' : 'bg-[#eeeeee] text-[#3f4945]'}`}>
                      {member.mfa_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${member.is_active ? 'bg-[#dcf5e3] text-[#1b7a3d]' : 'bg-[#eeeeee] text-[#3f4945]'}`}>
                      {member.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <StaffActionsMenu id={member.id} isActive={member.is_active} mfaEnabled={member.mfa_enabled} />
                  </td>
                </tr>
              );
            })}
            {staffList.length === 0 && !error && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No staff members match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-[#3f4945]">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Link
              href={page > 1 ? `/admin/staff${buildQueryString(params, { page: String(page - 1) })}` : '#'}
              aria-disabled={page <= 1}
              className={`px-3 py-1.5 border border-[#bfc9c4] ${page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-[#f5f3f3]'}`}
            >
              Previous
            </Link>
            <Link
              href={page < totalPages ? `/admin/staff${buildQueryString(params, { page: String(page + 1) })}` : '#'}
              aria-disabled={page >= totalPages}
              className={`px-3 py-1.5 border border-[#bfc9c4] ${page >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-[#f5f3f3]'}`}
            >
              Next
            </Link>
          </div>
        </div>
      )}

      {roleOptions.length === 0 && (
        <p className="mt-3 text-xs text-[#707975]">Role list unavailable — the roles table may not be migrated yet.</p>
      )}
    </div>
  );
}
