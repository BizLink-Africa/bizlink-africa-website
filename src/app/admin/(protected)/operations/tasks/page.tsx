import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import CreateTaskForm from '@/components/admin/operations/CreateTaskForm';
import TaskRow from '@/components/admin/operations/TaskRow';
import type { OperationalTask } from '@/data/operations';

export const dynamic = 'force-dynamic';

export default async function OperationalTasksPage() {
  let canManage = true;
  try {
    await requirePermission('operations.tasks.view');
  } catch {
    return <AccessDenied requiredPermission="operations.tasks.view" />;
  }
  try {
    await requirePermission('operations.tasks.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data: tasks, error }, { data: clients }, { data: projects }, { data: contracts }, { data: staffRows }] = await Promise.all([
    supabase.from('operational_tasks').select('*').order('created_at', { ascending: false }),
    supabase.from('clients').select('id, business_name').order('business_name'),
    supabase.from('projects').select('id, project_name').order('project_name'),
    supabase.from('contracts').select('id, contract_number').order('contract_number'),
    supabase.from('staff_profiles').select('id, full_name').eq('is_active', true).order('full_name'),
  ]);

  const clientNameById = new Map((clients ?? []).map((c) => [c.id, c.business_name]));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Operational Tasks</h1>
          <p className="text-sm text-[#707975] mt-1">{tasks?.length ?? 0} task{(tasks?.length ?? 0) === 1 ? '' : 's'}</p>
        </div>
        {canManage && <CreateTaskForm clients={clients ?? []} projects={projects ?? []} contracts={contracts ?? []} staff={staffRows ?? []} />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load tasks: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Task</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Assigned</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {((tasks ?? []) as OperationalTask[]).map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                staff={staffRows ?? []}
                clientName={task.client_id ? clientNameById.get(task.client_id) ?? '—' : '—'}
                readOnly={!canManage}
              />
            ))}
            {(tasks ?? []).length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No operational tasks yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
