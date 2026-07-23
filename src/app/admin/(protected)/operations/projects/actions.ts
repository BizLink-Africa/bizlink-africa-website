'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { PROJECT_STATUSES, type ProjectStatus } from '@/data/operations';

const VALID_STATUSES = new Set<string>(PROJECT_STATUSES.map((s) => s.value));
const MAX_TEXT_LENGTH = 2000;

export interface ProjectInput {
  projectName: string;
  clientId?: string;
  serviceKey?: string;
  contractId?: string;
  projectOwner?: string;
  startDate?: string;
  targetCompletionDate?: string;
}

export async function createProject(input: ProjectInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('projects.manage');
  } catch {
    return { success: false, message: 'You do not have permission to create projects.' };
  }

  if (!input.projectName?.trim()) {
    return { success: false, message: 'Project name is required.' };
  }

  const supabase = await createClient();
  const { data: numberData, error: numberError } = await supabase.rpc('next_finance_number', { seq_prefix: 'PRJ' });
  if (numberError || !numberData) {
    console.error('Failed to generate project number', numberError);
    return { success: false, message: 'Failed to generate a project number.' };
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      project_number: numberData,
      project_name: input.projectName.trim().slice(0, 200),
      client_id: input.clientId || null,
      service_key: input.serviceKey || null,
      contract_id: input.contractId || null,
      project_owner: input.projectOwner || null,
      start_date: input.startDate || null,
      target_completion_date: input.targetCompletionDate || null,
      status: 'planned',
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create project', error);
    return { success: false, message: 'Failed to create project.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'projects',
    recordId: data.id,
    newValue: { projectNumber: numberData, name: input.projectName },
  });

  revalidatePath('/admin/operations/projects');
  return { success: true, id: data.id };
}

export interface ProjectDetailsInput {
  status: ProjectStatus;
  progress: number;
  projectOwner?: string;
  targetCompletionDate?: string;
  completionDate?: string;
  risks?: string;
  blockers?: string;
  notes?: string;
}

export async function updateProjectDetails(id: string, input: ProjectDetailsInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('projects.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update this project.' };
  }

  if (!VALID_STATUSES.has(input.status)) {
    return { success: false, message: 'Invalid status.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('projects')
    .update({
      status: input.status,
      progress: Math.max(0, Math.min(100, input.progress)),
      project_owner: input.projectOwner || null,
      target_completion_date: input.targetCompletionDate || null,
      completion_date: input.status === 'completed' ? input.completionDate || new Date().toISOString().slice(0, 10) : null,
      risks: input.risks?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      blockers: input.blockers?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      notes: input.notes?.trim().slice(0, MAX_TEXT_LENGTH) || null,
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update project', id, error);
    return { success: false, message: 'Failed to save changes.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update',
    module: 'projects',
    recordId: id,
    newValue: { status: input.status, progress: input.progress },
  });

  revalidatePath('/admin/operations/projects');
  revalidatePath(`/admin/operations/projects/${id}`);
  return { success: true };
}

export async function addProjectTeamMember(projectId: string, staffId: string, roleOnProject?: string): Promise<{ success: boolean; message?: string }> {
  try {
    await requirePermission('projects.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage the project team.' };
  }

  if (!staffId) {
    return { success: false, message: 'Select a staff member.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('project_team_members')
    .insert({ project_id: projectId, staff_id: staffId, role_on_project: roleOnProject?.trim().slice(0, 100) || null });

  if (error) {
    console.error('Failed to add project team member', projectId, error);
    return { success: false, message: 'Failed to add team member (already on the team?).' };
  }

  revalidatePath(`/admin/operations/projects/${projectId}`);
  return { success: true };
}

export async function removeProjectTeamMember(projectId: string, memberId: string): Promise<{ success: boolean; message?: string }> {
  try {
    await requirePermission('projects.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage the project team.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('project_team_members').delete().eq('id', memberId);

  if (error) {
    console.error('Failed to remove project team member', memberId, error);
    return { success: false, message: 'Failed to remove team member.' };
  }

  revalidatePath(`/admin/operations/projects/${projectId}`);
  return { success: true };
}
