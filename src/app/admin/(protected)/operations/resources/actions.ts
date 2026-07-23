'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

export interface AllocationInput {
  staffId: string;
  projectId?: string;
  allocationPercent: number;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export async function createResourceAllocation(input: AllocationInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('resources.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage resource allocation.' };
  }

  if (!input.staffId) {
    return { success: false, message: 'Select a staff member.' };
  }
  if (!(input.allocationPercent > 0 && input.allocationPercent <= 100)) {
    return { success: false, message: 'Allocation must be between 1 and 100%.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('resource_allocations')
    .insert({
      staff_id: input.staffId,
      project_id: input.projectId || null,
      allocation_percent: input.allocationPercent,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      notes: input.notes?.trim().slice(0, 500) || null,
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create resource allocation', error);
    return { success: false, message: 'Failed to save allocation.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'resource_allocations',
    recordId: data.id,
    newValue: { staffId: input.staffId, allocationPercent: input.allocationPercent },
  });

  revalidatePath('/admin/operations/resources');
  return { success: true };
}

export async function deleteResourceAllocation(id: string): Promise<{ success: boolean; message?: string }> {
  try {
    await requirePermission('resources.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage resource allocation.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('resource_allocations').delete().eq('id', id);

  if (error) {
    console.error('Failed to delete resource allocation', id, error);
    return { success: false, message: 'Failed to remove allocation.' };
  }

  revalidatePath('/admin/operations/resources');
  return { success: true };
}
