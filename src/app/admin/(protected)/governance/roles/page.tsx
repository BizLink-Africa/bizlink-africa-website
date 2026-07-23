import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import RolePermissionMatrix from '@/components/admin/governance/RolePermissionMatrix';
import RoleManagementPanel from '@/components/admin/governance/RoleManagementPanel';
import type { Role, Permission } from '@/data/governance';

export const dynamic = 'force-dynamic';

export default async function GovernanceRolesPage() {
  let canManage = true;
  try {
    await requirePermission('roles.view');
  } catch {
    return <AccessDenied requiredPermission="roles.view" />;
  }
  try {
    await requirePermission('roles.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [
    { data: roles, error: rolesError },
    { data: permissions, error: permsError },
    { data: rolePermissions, error: rpError },
    { data: staffRows, error: staffError },
  ] = await Promise.all([
    supabase.from('roles').select('id, name, description, is_system, is_active').order('name'),
    supabase.from('permissions').select('id, module, description').order('module').order('id'),
    supabase.from('role_permissions').select('role_id, permission_id'),
    supabase.from('staff_profiles').select('role').eq('is_active', true),
  ]);

  const error = rolesError ?? permsError ?? rpError ?? staffError;

  const roleList = (roles ?? []) as Role[];
  const permissionList = (permissions ?? []) as Permission[];

  const assignedCounts: Record<string, number> = {};
  for (const row of staffRows ?? []) {
    assignedCounts[row.role] = (assignedCounts[row.role] ?? 0) + 1;
  }

  const permissionsByModule = Object.values(
    permissionList.reduce<Record<string, { module: string; permissions: Permission[] }>>((acc, p) => {
      acc[p.module] = acc[p.module] ?? { module: p.module, permissions: [] };
      acc[p.module].permissions.push(p);
      return acc;
    }, {})
  );

  const grantsByRole: Record<string, string[]> = {};
  for (const row of rolePermissions ?? []) {
    grantsByRole[row.role_id] = grantsByRole[row.role_id] ?? [];
    grantsByRole[row.role_id].push(row.permission_id);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Roles & Permissions</h1>
        <p className="text-sm text-[#707975] mt-1">
          What each role can do. To assign a role to a staff member, use{' '}
          <a href="/admin/staff" className="underline hover:text-[#00342b]">Staff & Roles</a>.
        </p>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load roles/permissions: {error.message}
        </p>
      )}

      <RoleManagementPanel roles={roleList} assignedCounts={assignedCounts} canManage={canManage} />

      <RolePermissionMatrix
        roles={roleList}
        permissionsByModule={permissionsByModule}
        grantsByRole={grantsByRole}
        canManage={canManage}
      />
    </div>
  );
}
