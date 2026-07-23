'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { TASK_STATUSES, TASK_PRIORITIES, type TaskStatus, type TaskPriority } from '@/data/operations';

const VALID_STATUSES = new Set<string>(TASK_STATUSES.map((s) => s.value));
const VALID_PRIORITIES = new Set<string>(TASK_PRIORITIES.map((p) => p.value));
const MAX_TEXT_LENGTH = 2000;

export interface TaskInput {
  title: string;
  description?: string;
  clientId?: string;
  projectId?: string;
  contractId?: string;
  assignedUserId?: string;
  department?: string;
  priority: TaskPriority;
  dueDate?: string;
}

export async function createOperationalTask(input: TaskInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('operations.tasks.manage');
  } catch {
    return { success: false, message: 'You do not have permission to create tasks.' };
  }

  if (!input.title?.trim()) {
    return { success: false, message: 'Title is required.' };
  }
  if (!VALID_PRIORITIES.has(input.priority)) {
    return { success: false, message: 'Invalid priority.' };
  }

  const supabase = await createClient();
  const { data: numberData, error: numberError } = await supabase.rpc('next_finance_number', { seq_prefix: 'TSK' });
  if (numberError || !numberData) {
    console.error('Failed to generate task number', numberError);
    return { success: false, message: 'Failed to generate a task number.' };
  }

  const { data, error } = await supabase
    .from('operational_tasks')
    .insert({
      task_number: numberData,
      title: input.title.trim().slice(0, 200),
      description: input.description?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      client_id: input.clientId || null,
      project_id: input.projectId || null,
      contract_id: input.contractId || null,
      assigned_user_id: input.assignedUserId || null,
      department: input.department?.trim().slice(0, 100) || null,
      priority: input.priority,
      due_date: input.dueDate || null,
      status: 'todo',
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create operational task', error);
    return { success: false, message: 'Failed to create task.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'operational_tasks',
    recordId: data.id,
    newValue: { taskNumber: numberData, title: input.title },
  });

  revalidatePath('/admin/operations/tasks');
  return { success: true, id: data.id };
}

export async function updateOperationalTaskStatus(id: string, status: TaskStatus): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('operations.tasks.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update this task.' };
  }

  if (!VALID_STATUSES.has(status)) {
    return { success: false, message: 'Invalid status.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('operational_tasks').update({ status }).eq('id', id);

  if (error) {
    console.error('Failed to update operational task status', id, error);
    return { success: false, message: 'Failed to update task status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'status_change',
    module: 'operational_tasks',
    recordId: id,
    newValue: { status },
  });

  revalidatePath('/admin/operations/tasks');
  return { success: true };
}

export interface UpdateTaskDetailsInput {
  assignedUserId?: string;
  blocker?: string;
  notes?: string;
}

export async function updateOperationalTaskDetails(id: string, input: UpdateTaskDetailsInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('operations.tasks.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update this task.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('operational_tasks')
    .update({
      assigned_user_id: input.assignedUserId || null,
      blocker: input.blocker?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      notes: input.notes?.trim().slice(0, MAX_TEXT_LENGTH) || null,
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update operational task details', id, error);
    return { success: false, message: 'Failed to save changes.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_details',
    module: 'operational_tasks',
    recordId: id,
    newValue: { assignedUserId: input.assignedUserId ?? null },
  });

  revalidatePath('/admin/operations/tasks');
  return { success: true };
}
