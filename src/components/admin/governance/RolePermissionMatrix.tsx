'use client';

import { Fragment, useState, useTransition } from 'react';
import type { Role, Permission } from '@/data/governance';
import { toggleRolePermission } from '@/app/admin/(protected)/governance/roles/actions';

export default function RolePermissionMatrix({
  roles,
  permissionsByModule,
  grantsByRole,
  canManage,
}: {
  roles: Role[];
  permissionsByModule: { module: string; permissions: Permission[] }[];
  grantsByRole: Record<string, string[]>;
  canManage: boolean;
}) {
  const [grants, setGrants] = useState<Record<string, Set<string>>>(
    Object.fromEntries(roles.map((r) => [r.id, new Set(grantsByRole[r.id] ?? [])]))
  );
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const isGranted = (roleId: string, permissionId: string) => grants[roleId]?.has(permissionId) ?? false;

  const handleToggle = (roleId: string, permissionId: string) => {
    if (!canManage || roleId === 'super_admin') return;
    const key = `${roleId}:${permissionId}`;
    const nextGranted = !isGranted(roleId, permissionId);

    setError(null);
    setGrants((prev) => {
      const next = { ...prev, [roleId]: new Set(prev[roleId]) };
      if (nextGranted) next[roleId].add(permissionId);
      else next[roleId].delete(permissionId);
      return next;
    });
    setPendingKey(key);

    startTransition(async () => {
      const result = await toggleRolePermission(roleId, permissionId, nextGranted);
      setPendingKey(null);
      if (!result.success) {
        setGrants((prev) => {
          const next = { ...prev, [roleId]: new Set(prev[roleId]) };
          if (nextGranted) next[roleId].delete(permissionId);
          else next[roleId].add(permissionId);
          return next;
        });
        setError(result.message ?? 'Failed to save.');
      }
    });
  };

  return (
    <div>
      {error && <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3 sticky left-0 bg-white">Permission</th>
              {roles.map((r) => (
                <th key={r.id} className="px-3 py-3 text-center whitespace-nowrap">
                  {r.name}
                  {r.id === 'super_admin' && <span className="block text-[10px] normal-case font-normal text-[#707975]">locked</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissionsByModule.map((group) => (
              <Fragment key={group.module}>
                <tr className="bg-[#f5f3f3]">
                  <td colSpan={roles.length + 1} className="px-4 py-1.5 text-xs font-semibold text-[#00342b] uppercase tracking-wider">
                    {group.module}
                  </td>
                </tr>
                {group.permissions.map((p) => (
                  <tr key={p.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                    <td className="px-4 py-2 text-[#3f4945] sticky left-0 bg-white">
                      <span className="font-mono text-xs">{p.id}</span>
                      {p.description && <span className="block text-xs text-[#707975]">{p.description}</span>}
                    </td>
                    {roles.map((r) => {
                      const key = `${r.id}:${p.id}`;
                      const locked = r.id === 'super_admin';
                      return (
                        <td key={key} className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={locked ? true : isGranted(r.id, p.id)}
                            disabled={!canManage || locked || pendingKey === key}
                            onChange={() => handleToggle(r.id, p.id)}
                            className="w-4 h-4 accent-[#00342b] disabled:opacity-50"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
