'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

const MAX_TEXT_LENGTH = 200;

// The 8 department rows are seeded by migration and are the fixed catalog
// (also enforced by staff_profiles.department's CHECK constraint) — this
// only ever updates manager/description/status on an existing row, never
// creates or deletes one.
export async function updateDepartment(
  id: string,
  input: { manager?: string; description?: string; status?: string }
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('departments.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage departments.' };
  }

  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (input.manager !== undefined) update.manager = input.manager.trim().slice(0, MAX_TEXT_LENGTH) || null;
  if (input.description !== undefined) update.description = input.description.trim() || null;
  if (input.status !== undefined) update.status = input.status;

  const { error } = await supabase.from('departments').update(update).eq('id', id);

  if (error) {
    console.error('Failed to update department', id, error);
    return { success: false, message: 'Failed to update department.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update',
    module: 'departments',
    recordId: id,
    newValue: update,
  });

  revalidatePath('/admin/governance/departments');
  revalidatePath('/admin/governance');
  return { success: true };
}

// Single-argument wrappers so InlineText/InlineSelect (Client Components)
// can bind them directly — onSave={updateDepartmentManager.bind(null, d.id)}
// — rather than being passed a plain arrow-function closure, which React
// rejects as a Client Component prop from a Server Component.
export async function updateDepartmentStatus(id: string, status: string): Promise<{ success: boolean; message?: string }> {
  return updateDepartment(id, { status });
}

export async function updateDepartmentManager(id: string, manager: string): Promise<{ success: boolean; message?: string }> {
  return updateDepartment(id, { manager });
}

export async function updateDepartmentDescription(id: string, description: string): Promise<{ success: boolean; message?: string }> {
  return updateDepartment(id, { description });
}
