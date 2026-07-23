import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import Pill from '@/components/admin/operations/Pill';
import AllocateStaffForm from '@/components/admin/operations/AllocateStaffForm';
import RemoveAllocationButton from '@/components/admin/operations/RemoveAllocationButton';

export const dynamic = 'force-dynamic';

export default async function ResourceAllocationPage() {
  let canManage = true;
  try {
    await requirePermission('resources.view');
  } catch {
    return <AccessDenied requiredPermission="resources.view" />;
  }
  try {
    await requirePermission('resources.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const todayStr = new Date().toISOString().slice(0, 10);

  const [{ data: staffRows, error }, { data: allocations }, { data: projects }] = await Promise.all([
    supabase.from('staff_profiles').select('id, full_name, capacity_percent').eq('is_active', true).order('full_name'),
    supabase.from('resource_allocations').select('id, staff_id, project_id, allocation_percent, start_date, end_date, notes'),
    supabase.from('projects').select('id, project_name'),
  ]);

  const projectNameById = new Map((projects ?? []).map((p) => [p.id, p.project_name]));

  const activeAllocations = (allocations ?? []).filter(
    (a) => (!a.start_date || a.start_date <= todayStr) && (!a.end_date || a.end_date >= todayStr)
  );

  const workloadByStaff = new Map<string, number>();
  for (const a of activeAllocations) {
    workloadByStaff.set(a.staff_id, (workloadByStaff.get(a.staff_id) ?? 0) + a.allocation_percent);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Resource Allocation</h1>
          <p className="text-sm text-[#707975] mt-1">Staff workload vs. capacity, and per-project allocations.</p>
        </div>
        {canManage && <AllocateStaffForm staff={staffRows ?? []} projects={projects ?? []} />}
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load staff: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Capacity</th>
              <th className="px-4 py-3">Current Workload</th>
              <th className="px-4 py-3">Availability</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(staffRows ?? []).map((s) => {
              const workload = workloadByStaff.get(s.id) ?? 0;
              const availability = s.capacity_percent - workload;
              const isConflict = workload > s.capacity_percent;
              return (
                <tr key={s.id} className="border-b border-[#e5e5e5] last:border-0">
                  <td className="px-4 py-3 font-medium text-[#1b1c1c]">{s.full_name}</td>
                  <td className="px-4 py-3 text-[#3f4945] tabular-nums">{s.capacity_percent}%</td>
                  <td className="px-4 py-3 text-[#3f4945] tabular-nums">{workload}%</td>
                  <td className="px-4 py-3 text-[#3f4945] tabular-nums">{Math.max(0, availability)}%</td>
                  <td className="px-4 py-3">
                    {isConflict ? <Pill label="Over-allocated" tone="danger" /> : <Pill label="OK" tone="success" />}
                  </td>
                </tr>
              );
            })}
            {(staffRows ?? []).length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-[#707975]">No active staff.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-3">Allocations</h2>
        {(allocations ?? []).length === 0 ? (
          <p className="text-sm text-[#707975]">No allocations recorded yet.</p>
        ) : (
          <ul className="divide-y divide-[#e5e5e5]">
            {(allocations ?? []).map((a) => {
              const staffName = (staffRows ?? []).find((s) => s.id === a.staff_id)?.full_name ?? 'Unknown';
              return (
                <li key={a.id} className="py-2 flex items-center justify-between text-sm gap-2 flex-wrap">
                  <span>
                    {staffName} — {a.allocation_percent}% on {a.project_id ? projectNameById.get(a.project_id) ?? 'Unknown project' : 'General'}
                    {a.start_date && <span className="text-xs text-[#707975]"> ({a.start_date} – {a.end_date ?? 'ongoing'})</span>}
                  </span>
                  {canManage && <RemoveAllocationButton id={a.id} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
