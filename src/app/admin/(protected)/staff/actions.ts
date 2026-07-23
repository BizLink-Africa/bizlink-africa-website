'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logAuditEvent } from '@/lib/audit';

const MAX_TEXT_LENGTH = 200;

export interface StaffInput {
  fullName: string;
  email: string;
  role: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

async function roleExists(supabase: Awaited<ReturnType<typeof createClient>>, roleId: string): Promise<boolean> {
  const { data } = await supabase.from('roles').select('id').eq('id', roleId).maybeSingle();
  return Boolean(data);
}

// Invites a new staff member: creates their Supabase Auth account in
// "invited" state (Supabase emails them a one-time link straight to
// /admin/accept-invite, where the page's Supabase browser client
// auto-detects the session Supabase appends to the URL and lets them set a
// password), then creates the linked staff_profiles row immediately, so RLS
// recognizes them as active staff the moment they accept. Requires
// users.manage — inviting someone *is* granting them real dashboard access.
export async function inviteStaff(input: StaffInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('users.manage');
  } catch {
    return { success: false, message: 'You do not have permission to invite staff.' };
  }

  if (!isNonEmptyString(input.fullName) || !isNonEmptyString(input.email)) {
    return { success: false, message: 'Full name and email are required.' };
  }

  const supabase = await createClient();
  if (!(await roleExists(supabase, input.role))) {
    return { success: false, message: 'Invalid role.' };
  }

  const email = input.email.trim().slice(0, MAX_TEXT_LENGTH);
  // The staff-facing app lives on the admin host, not the public marketing
  // site — this link must survive host separation (see src/proxy.ts), where
  // the public host 404s every /admin/* path.
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3000';

  const serviceClient = createServiceClient();
  const { data: invited, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${adminUrl}/admin/accept-invite?email=${encodeURIComponent(email)}`,
  });

  if (inviteError || !invited.user) {
    console.error('Failed to invite staff member', email, inviteError);
    return { success: false, message: inviteError?.message ?? 'Failed to send invite.' };
  }

  const { data, error } = await supabase
    .from('staff_profiles')
    .insert({
      user_id: invited.user.id,
      full_name: input.fullName.trim().slice(0, MAX_TEXT_LENGTH),
      email,
      role: input.role,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create staff profile after invite', email, error);
    // Roll back the auth invite so a failed profile insert doesn't leave a
    // dangling, unlinked login with no corresponding staff record.
    await serviceClient.auth.admin.deleteUser(invited.user.id);
    return { success: false, message: 'Failed to add staff member.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'invite',
    module: 'staff_profiles',
    recordId: data.id,
    newValue: input,
  });

  revalidatePath('/admin/staff');
  return { success: true, message: `Invite sent to ${email}.` };
}

export async function updateStaffRole(id: string, role: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('roles.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change staff roles.' };
  }

  const supabase = await createClient();

  if (!(await roleExists(supabase, role))) {
    return { success: false, message: 'Invalid role.' };
  }

  const { data: target } = await supabase.from('staff_profiles').select('user_id').eq('id', id).maybeSingle();
  if (target?.user_id === user.id && role !== 'super_admin') {
    return { success: false, message: 'You cannot change your own role away from super admin.' };
  }

  const { error } = await supabase.from('staff_profiles').update({ role }).eq('id', id);

  if (error) {
    console.error('Failed to update staff role', id, error);
    return { success: false, message: error.message.includes('last active Super Admin') ? error.message : 'Failed to update role.' };
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

export async function updateStaffDepartment(id: string, department: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('users.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change staff department.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('staff_profiles').update({ department: department || null }).eq('id', id);

  if (error) {
    console.error('Failed to update staff department', id, error);
    return { success: false, message: 'Failed to update department.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_department',
    module: 'staff_profiles',
    recordId: id,
    newValue: { department },
  });

  revalidatePath('/admin/staff');
  revalidatePath('/admin/governance/departments');
  return { success: true };
}

export async function setStaffActive(id: string, isActive: boolean): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('users.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change account status.' };
  }

  const supabase = await createClient();

  if (!isActive) {
    const { data: target } = await supabase.from('staff_profiles').select('user_id').eq('id', id).maybeSingle();
    if (target?.user_id === user.id) {
      return { success: false, message: 'You cannot deactivate your own account.' };
    }
  }

  const { error } = await supabase.from('staff_profiles').update({ is_active: isActive }).eq('id', id);

  if (error) {
    console.error('Failed to update staff active status', id, error);
    return { success: false, message: error.message.includes('last active Super Admin') ? error.message : 'Failed to update account status.' };
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

export async function setStaffMfa(id: string, mfaEnabled: boolean): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('users.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change MFA status.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('staff_profiles').update({ mfa_enabled: mfaEnabled }).eq('id', id);

  if (error) {
    console.error('Failed to update staff MFA status', id, error);
    return { success: false, message: 'Failed to update MFA status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_mfa_status',
    module: 'staff_profiles',
    recordId: id,
    newValue: { mfaEnabled },
  });

  revalidatePath('/admin/staff');
  return { success: true };
}
