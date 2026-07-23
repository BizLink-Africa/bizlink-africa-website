import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import Pill from '@/components/admin/operations/Pill';
import ProjectDetailForm from '@/components/admin/operations/ProjectDetailForm';
import ProjectTeamPanel from '@/components/admin/operations/ProjectTeamPanel';
import { PROJECT_STATUSES, MILESTONE_STATUSES, labelFor, type Project, type ProjectMilestone } from '@/data/operations';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  const supabase = await createClient();

  const [{ data, error }, { data: staffRows }, { data: teamRows }, { data: milestoneRows }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('staff_profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    supabase.from('project_team_members').select('id, staff_id, role_on_project').eq('project_id', id),
    supabase.from('project_milestones').select('*').eq('project_id', id).order('due_date', { ascending: true, nullsFirst: false }),
  ]);

  if (error || !data) {
    notFound();
  }

  const project = data as Project;
  const clientRow = project.client_id
    ? (await supabase.from('clients').select('business_name').eq('id', project.client_id).single()).data
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/operations/projects" className="inline-flex items-center gap-1.5 text-sm text-[#00342b] hover:underline mb-3">
          <ArrowLeft size={14} /> Back to Projects
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-bold text-2xl text-[#00342b]">{project.project_name}</h1>
            <p className="text-sm text-[#707975] mt-1">{project.project_number} {clientRow?.business_name ? `· ${clientRow.business_name}` : ''}</p>
          </div>
          <Pill label={labelFor(PROJECT_STATUSES, project.status)} tone="info" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {canManage ? (
            <ProjectDetailForm
              id={id}
              initialStatus={project.status}
              initialProgress={project.progress}
              initialProjectOwner={project.project_owner ?? ''}
              initialTargetCompletionDate={project.target_completion_date ?? ''}
              initialRisks={project.risks ?? ''}
              initialBlockers={project.blockers ?? ''}
              initialNotes={project.notes ?? ''}
              staff={staffRows ?? []}
            />
          ) : (
            <div className="bg-white border border-[#bfc9c4] p-6 space-y-2 text-sm text-[#3f4945]">
              <p><span className="font-semibold text-[#707975]">Progress:</span> {project.progress}%</p>
              <p><span className="font-semibold text-[#707975]">Risks:</span> {project.risks ?? '—'}</p>
              <p><span className="font-semibold text-[#707975]">Blockers:</span> {project.blockers ?? '—'}</p>
            </div>
          )}

          <div className="bg-white border border-[#bfc9c4] p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[#00342b]">Delivery Milestones</h2>
              <Link href={`/admin/operations/milestones?project=${id}`} className="text-xs font-medium text-[#00342b] hover:underline">
                Manage milestones →
              </Link>
            </div>
            {(milestoneRows ?? []).length === 0 ? (
              <p className="text-sm text-[#707975]">No milestones yet.</p>
            ) : (
              <ul className="divide-y divide-[#e5e5e5]">
                {(milestoneRows as ProjectMilestone[]).map((m) => (
                  <li key={m.id} className="py-2 flex items-center justify-between text-sm gap-2 flex-wrap">
                    <span className="text-[#1b1c1c]">{m.title}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-[#707975]">{m.due_date ?? '—'}</span>
                      <Pill label={labelFor(MILESTONE_STATUSES, m.status)} tone="neutral" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <ProjectTeamPanel projectId={id} members={teamRows ?? []} staff={staffRows ?? []} readOnly={!canManage} />
      </div>
    </div>
  );
}
