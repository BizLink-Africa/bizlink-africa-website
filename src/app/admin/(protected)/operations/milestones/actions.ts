'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { MILESTONE_STATUSES, type MilestoneStatus } from '@/data/operations';

const VALID_STATUSES = new Set<string>(MILESTONE_STATUSES.map((s) => s.value));

export interface MilestoneInput {
  projectId: string;
  title: string;
  owner?: string;
  dueDate?: string;
  dependencies?: string[];
  acceptanceRequirement?: string;
}

export async function createMilestone(input: MilestoneInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('projects.manage');
  } catch {
    return { success: false, message: 'You do not have permission to create milestones.' };
  }

  if (!input.projectId || !input.title.trim()) {
    return { success: false, message: 'Project and title are required.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('project_milestones').insert({
    project_id: input.projectId,
    title: input.title.trim().slice(0, 200),
    owner: input.owner || null,
    due_date: input.dueDate || null,
    dependencies: (input.dependencies ?? []).map((d) => d.trim()).filter(Boolean),
    acceptance_requirement: input.acceptanceRequirement?.trim().slice(0, 500) || null,
    status: 'pending',
  });

  if (error) {
    console.error('Failed to create milestone', error);
    return { success: false, message: 'Failed to create milestone.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'project_milestones',
    newValue: { title: input.title, projectId: input.projectId },
  });

  revalidatePath('/admin/operations/milestones');
  revalidatePath(`/admin/operations/projects/${input.projectId}`);
  return { success: true };
}

export async function updateMilestoneStatus(id: string, projectId: string, status: MilestoneStatus): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('projects.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update this milestone.' };
  }

  if (!VALID_STATUSES.has(status)) {
    return { success: false, message: 'Invalid status.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('project_milestones')
    .update({ status, completion_date: status === 'completed' ? new Date().toISOString().slice(0, 10) : null })
    .eq('id', id);

  if (error) {
    console.error('Failed to update milestone status', id, error);
    return { success: false, message: 'Failed to update milestone.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'status_change',
    module: 'project_milestones',
    recordId: id,
    newValue: { status },
  });

  revalidatePath('/admin/operations/milestones');
  revalidatePath(`/admin/operations/projects/${projectId}`);
  return { success: true };
}
