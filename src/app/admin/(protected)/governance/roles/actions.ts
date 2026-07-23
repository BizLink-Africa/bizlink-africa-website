'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

// super_admin is intentionally excluded from editing here: it always holds
// every permission (seeded once, in bulk, by the RBAC foundation migration)
// and there is no DB-level trigger guarding role_permissions deletions the
// way protect_staff_role_changes() guards staff_profiles.role — so without
// this check, someone could uncheck their own role's access here and lock
// every super admin out of the platform with no recovery path.
export async function toggleRolePermission(
  roleId: string,
  permissionId: string,
  granted: boolean
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('roles.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage roles.' };
  }

  if (roleId === 'super_admin') {
    return { success: false, message: "The Super Admin role's permissions cannot be changed — it always has full access." };
  }

  const supabase = await createClient();

  if (granted) {
    const { error } = await supabase.from('role_permissions').insert({ role_id: roleId, permission_id: permissionId });
    if (error) {
      console.error('Failed to grant permission', roleId, permissionId, error);
      return { success: false, message: 'Failed to grant permission.' };
    }
  } else {
    const { error } = await supabase.from('role_permissions').delete().eq('role_id', roleId).eq('permission_id', permissionId);
    if (error) {
      console.error('Failed to revoke permission', roleId, permissionId, error);
      return { success: false, message: 'Failed to revoke permission.' };
    }
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: granted ? 'grant_permission' : 'revoke_permission',
    module: 'role_permissions',
    recordId: `${roleId}:${permissionId}`,
    newValue: { roleId, permissionId, granted },
  });

  revalidatePath('/admin/governance/roles');
  return { success: true };
}

const MAX_TEXT_LENGTH = 200;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  cloneFromRoleId?: string;
}

// Every new role is a custom role (is_system=false) — only the 8 seeded
// roles are system roles, and that flag is what protect_system_roles() (the
// DB trigger) uses to lock identity/liveness. cloneFromRoleId copies the
// SOURCE role's current permission grants as a starting point — it never
// links the two roles together afterward, so editing the clone's
// permissions has no effect on the original.
export async function createRole(input: CreateRoleInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('roles.manage');
  } catch {
    return { success: false, message: 'You do not have permission to create roles.' };
  }

  if (!isNonEmptyString(input.name)) {
    return { success: false, message: 'A role name is required.' };
  }

  const id = slugify(input.name);
  if (!id) {
    return { success: false, message: 'Role name must contain at least one letter or number.' };
  }

  const supabase = await createClient();

  const { data: role, error } = await supabase
    .from('roles')
    .insert({
      id,
      name: input.name.trim().slice(0, MAX_TEXT_LENGTH),
      description: input.description?.trim() || null,
      is_system: false,
    })
    .select('id')
    .single();

  if (error || !role) {
    console.error('Failed to create role', error);
    const message = error?.code === '23505' ? 'A role with that name already exists.' : 'Failed to create role.';
    return { success: false, message };
  }

  if (input.cloneFromRoleId) {
    const { data: sourcePermissions } = await supabase
      .from('role_permissions')
      .select('permission_id')
      .eq('role_id', input.cloneFromRoleId);

    if (sourcePermissions && sourcePermissions.length > 0) {
      const { error: cloneError } = await supabase
        .from('role_permissions')
        .insert(sourcePermissions.map((p) => ({ role_id: role.id, permission_id: p.permission_id })));
      if (cloneError) {
        console.error('Failed to clone permissions onto new role', role.id, cloneError);
      }
    }
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: input.cloneFromRoleId ? 'clone' : 'create',
    module: 'roles',
    recordId: role.id,
    newValue: { name: input.name, clonedFrom: input.cloneFromRoleId ?? null },
  });

  revalidatePath('/admin/governance/roles');
  revalidatePath('/admin/governance');
  return { success: true, id: role.id };
}

export async function updateRoleDetails(
  roleId: string,
  input: { name: string; description?: string }
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('roles.manage');
  } catch {
    return { success: false, message: 'You do not have permission to edit roles.' };
  }

  if (!isNonEmptyString(input.name)) {
    return { success: false, message: 'A role name is required.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('roles')
    .update({ name: input.name.trim().slice(0, MAX_TEXT_LENGTH), description: input.description?.trim() || null })
    .eq('id', roleId);

  if (error) {
    console.error('Failed to update role', roleId, error);
    // System roles are blocked at the DB layer (protect_system_roles trigger)
    // for renames — surface that as a clean message instead of a raw PG error.
    const message = error.message.includes('cannot be renamed') ? 'System roles cannot be renamed.' : 'Failed to update role.';
    return { success: false, message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update',
    module: 'roles',
    recordId: roleId,
    newValue: input,
  });

  revalidatePath('/admin/governance/roles');
  return { success: true };
}

// Deactivating a role does not touch its role_permissions rows — has_permission()
// simply stops honoring them for anyone still assigned that role (see
// 20260801010000_extend_roles_for_governance.sql), so reactivating restores
// the exact same grants. System roles are blocked at the DB layer
// (protect_system_roles) regardless of what's checked here.
export async function setRoleActive(roleId: string, isActive: boolean): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('roles.manage');
  } catch {
    return { success: false, message: 'You do not have permission to activate/deactivate roles.' };
  }

  if (roleId === 'super_admin') {
    return { success: false, message: "The Super Admin role cannot be deactivated." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('roles').update({ is_active: isActive }).eq('id', roleId);

  if (error) {
    console.error('Failed to update role active status', roleId, error);
    const message = error.message.includes('cannot be deactivated') ? 'System roles cannot be deactivated.' : 'Failed to update role status.';
    return { success: false, message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: isActive ? 'activate' : 'deactivate',
    module: 'roles',
    recordId: roleId,
    newValue: { isActive },
  });

  revalidatePath('/admin/governance/roles');
  revalidatePath('/admin/governance');
  return { success: true };
}
