import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import CreateMilestoneForm from '@/components/admin/operations/CreateMilestoneForm';
import MilestoneStatusSelect from '@/components/admin/operations/MilestoneStatusSelect';
import type { ProjectMilestone, MilestoneStatus } from '@/data/operations';

export const dynamic = 'force-dynamic';

export default async function MilestonesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  let canManage = true;
  try {
    await requirePermission('projects.view');
  } catch {
    return <AccessDenied requiredPermission="projects.view" />;
  }
  try {
    await requirePermission('projects.manage');
  } catch {
    canManage = false;
  }

  const { project: projectFilter } = await searchParams;
  const supabase = await createClient();

  const [{ data: milestones, error }, { data: projects }, { data: staffRows }] = await Promise.all([
    supabase.from('project_milestones').select('*').order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('projects').select('id, project_name').order('project_name'),
    supabase.from('staff_profiles').select('id, full_name').eq('is_active', true).order('full_name'),
  ]);

  const projectNameById = new Map((projects ?? []).map((p) => [p.id, p.project_name]));
  const staffNameById = new Map((staffRows ?? []).map((s) => [s.id, s.full_name]));

  const rows = ((milestones ?? []) as ProjectMilestone[]).filter((m) => !projectFilter || m.project_id === projectFilter);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Delivery Milestones</h1>
          <p className="text-sm text-[#707975] mt-1">
            {rows.length} milestone{rows.length === 1 ? '' : 's'}
            {projectFilter && projectNameById.has(projectFilter) && ` for ${projectNameById.get(projectFilter)}`}
          </p>
          {projectFilter && (
            <Link href="/admin/operations/milestones" className="text-xs text-[#00342b] hover:underline">Clear filter</Link>
          )}
        </div>
        {canManage && <CreateMilestoneForm projects={projects ?? []} staff={staffRows ?? []} defaultProjectId={projectFilter} />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load milestones: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Milestone</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">
                  <Link href={`/admin/operations/projects/${m.project_id}`} className="hover:underline">{m.title}</Link>
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{projectNameById.get(m.project_id) ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{m.owner ? staffNameById.get(m.owner) ?? '—' : '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{m.due_date ?? '—'}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <MilestoneStatusSelect id={m.id} projectId={m.project_id} status={m.status as MilestoneStatus} />
                  ) : (
                    <span className="text-[#3f4945]">{m.status}</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-[#707975]">No milestones in this view.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
