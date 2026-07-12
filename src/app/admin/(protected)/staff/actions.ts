'use server';

import { revalidatePath } from 'next/cache';
import { verifyAdminSession, requireSuperAdmin } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { STAFF_ROLES } from '@/data/staff';

const VALID_ROLES = new Set<string>(STAFF_ROLES.map((r) => r.value));
const MAX_TEXT_LENGTH = 200;

export interface StaffInput {
  fullName: string;
  email: string;
  role: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function createStaff(input: StaffInput): Promise<{ success: boolean; message?: string }> {
  const user = await verifyAdminSession();

  if (!isNonEmptyString(input.fullName) || !isNonEmptyString(input.email)) {
    return { success: false, message: 'Full name and email are required.' };
  }
  if (!VALID_ROLES.has(input.role)) {
    return { success: false, message: 'Invalid role.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('staff_profiles')
    .insert({
      full_name: input.fullName.trim().slice(0, MAX_TEXT_LENGTH),
      email: input.email.trim().slice(0, MAX_TEXT_LENGTH),
      role: input.role,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create staff profile', error);
    return { success: false, message: 'Failed to add staff member.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'staff_profiles',
    recordId: data.id,
    newValue: input,
  });

  revalidatePath('/admin/staff');
  return { success: true };
}

export async function updateStaffRole(id: string, role: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requireSuperAdmin();
  } catch {
    return { success: false, message: 'Only a super admin can change staff roles.' };
  }

  if (!VALID_ROLES.has(role)) {
    return { success: false, message: 'Invalid role.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('staff_profiles').update({ role }).eq('id', id);

  if (error) {
    console.error('Failed to update staff role', id, error);
    return { success: false, message: 'Failed to update role.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_role',
    module: 'staff_profiles',
    recordId: id,
    newValue: { role },
  });

  revalidatePath('/admin/staff');
  return { success: true };
}

export async function setStaffActive(id: string, isActive: boolean): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requireSuperAdmin();
  } catch {
    return { success: false, message: 'Only a super admin can change account status.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('staff_profiles').update({ is_active: isActive }).eq('id', id);

  if (error) {
    console.error('Failed to update staff active status', id, error);
    return { success: false, message: 'Failed to update account status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_active_status',
    module: 'staff_profiles',
    recordId: id,
    newValue: { isActive },
  });

  revalidatePath('/admin/staff');
  return { success: true };
}
