import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import Pill from '@/components/admin/operations/Pill';
import CreateProjectForm from '@/components/admin/operations/CreateProjectForm';
import { PROJECT_STATUSES, labelFor, type ProjectStatus } from '@/data/operations';

export const dynamic = 'force-dynamic';

const STATUS_TONES: Record<ProjectStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  planned: 'neutral',
  in_progress: 'info',
  on_hold: 'warning',
  delayed: 'danger',
  completed: 'success',
  cancelled: 'neutral',
};

export default async function ProjectsPage() {
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

  const supabase = await createClient();
  const [{ data: projects, error }, { data: clients }, { data: contracts }, { data: staffRows }] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('clients').select('id, business_name').order('business_name'),
    supabase.from('contracts').select('id, contract_number').order('contract_number'),
    supabase.from('staff_profiles').select('id, full_name').eq('is_active', true).order('full_name'),
  ]);

  const clientNameById = new Map((clients ?? []).map((c) => [c.id, c.business_name]));
  const staffNameById = new Map((staffRows ?? []).map((s) => [s.id, s.full_name]));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Projects</h1>
          <p className="text-sm text-[#707975] mt-1">{projects?.length ?? 0} project{(projects?.length ?? 0) === 1 ? '' : 's'}</p>
        </div>
        {canManage && <CreateProjectForm clients={clients ?? []} contracts={contracts ?? []} staff={staffRows ?? []} />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load projects: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Progress</th>
              <th className="px-4 py-3">Target Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {(projects ?? []).map((p) => (
              <tr key={p.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#00342b]">
                  <Link href={`/admin/operations/projects/${p.id}`} className="hover:underline">{p.project_number} — {p.project_name}</Link>
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{p.client_id ? clientNameById.get(p.client_id) ?? '—' : '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{p.project_owner ? staffNameById.get(p.project_owner) ?? '—' : '—'}</td>
                <td className="px-4 py-3 text-[#3f4945] tabular-nums">{p.progress}%</td>
                <td className="px-4 py-3 text-[#3f4945]">{p.target_completion_date ?? '—'}</td>
                <td className="px-4 py-3"><Pill label={labelFor(PROJECT_STATUSES, p.status)} tone={STATUS_TONES[p.status as ProjectStatus] ?? 'neutral'} /></td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/operations/projects/${p.id}`}
                    className="text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors whitespace-nowrap"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {(projects ?? []).length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No projects yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
