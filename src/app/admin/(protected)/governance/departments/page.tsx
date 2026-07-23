import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import InlineText from '@/components/admin/InlineText';
import InlineSelect from '@/components/admin/InlineSelect';
import { DEPARTMENT_STATUSES, labelForStatus, type Department } from '@/data/departments';
import { updateDepartmentDescription, updateDepartmentManager, updateDepartmentStatus } from './actions';

export const dynamic = 'force-dynamic';

export default async function DepartmentsPage() {
  let canManage = true;
  try {
    await requirePermission('departments.view');
  } catch {
    return <AccessDenied requiredPermission="departments.view" />;
  }
  try {
    await requirePermission('departments.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data: departments, error }, { data: staffRows }] = await Promise.all([
    supabase.from('departments').select('*').order('name'),
    supabase.from('staff_profiles').select('department').eq('is_active', true),
  ]);

  const staffCountByDepartment: Record<string, number> = {};
  for (const row of staffRows ?? []) {
    if (!row.department) continue;
    staffCountByDepartment[row.department] = (staffCountByDepartment[row.department] ?? 0) + 1;
  }

  const departmentList = (departments ?? []) as Department[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Departments</h1>
        <p className="text-sm text-[#707975] mt-1">
          {departmentList.length} department{departmentList.length === 1 ? '' : 's'}. Staff counts reflect the
          department set on each active staff member&apos;s{' '}
          <a href="/admin/staff" className="underline hover:text-[#00342b]">Staff &amp; Roles</a> profile.
        </p>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load departments: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3">Staff Count</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {departmentList.map((d) => (
              <tr key={d.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3] align-top">
                <td className="px-4 py-3 font-medium text-[#00342b]">{d.name}</td>
                <td className="px-4 py-3 min-w-[160px]">
                  {canManage ? (
                    <InlineText value={d.manager ?? ''} placeholder="Unassigned" onSave={updateDepartmentManager.bind(null, d.id)} />
                  ) : (
                    <span className="text-[#3f4945]">{d.manager ?? '—'}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{staffCountByDepartment[d.name] ?? 0}</td>
                <td className="px-4 py-3 min-w-[240px]">
                  {canManage ? (
                    <InlineText value={d.description ?? ''} placeholder="No description" onSave={updateDepartmentDescription.bind(null, d.id)} />
                  ) : (
                    <span className="text-[#3f4945]">{d.description ?? '—'}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <InlineSelect value={d.status} options={DEPARTMENT_STATUSES} onSave={updateDepartmentStatus.bind(null, d.id)} />
                  ) : (
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${d.status === 'active' ? 'bg-[#dcf5e3] text-[#1b7a3d]' : 'bg-[#eeeeee] text-[#3f4945]'}`}>
                      {labelForStatus(d.status)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {departmentList.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No departments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
