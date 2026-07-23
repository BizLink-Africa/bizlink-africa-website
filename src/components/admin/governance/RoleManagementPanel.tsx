'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Pencil } from 'lucide-react';
import type { Role } from '@/data/governance';
import { createRole, updateRoleDetails, setRoleActive } from '@/app/admin/(protected)/governance/roles/actions';

const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

function NewRoleForm({ roles, onCreated }: { roles: Role[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cloneFromRoleId, setCloneFromRoleId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await createRole({ name, description, cloneFromRoleId: cloneFromRoleId || undefined });
    setSubmitting(false);
    if (result.success) {
      setName('');
      setDescription('');
      setCloneFromRoleId('');
      setOpen(false);
      onCreated();
    } else {
      setError(result.message ?? 'Failed to create role.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> New Role
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">New Custom Role</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass} htmlFor="role-name">Name</label>
          <input id="role-name" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="role-description">Description</label>
          <input id="role-description" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </div>
        <div className="sm:col-span-3">
          <label className={labelClass} htmlFor="role-clone">Clone permissions from (optional)</label>
          <select id="role-clone" value={cloneFromRoleId} onChange={(e) => setCloneFromRoleId(e.target.value)} className={inputClass}>
            <option value="">Start with no permissions</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Creating...' : 'Create Role'}
      </button>
    </form>
  );
}

function EditRoleRow({ role, onSaved }: { role: Role; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <div className="flex items-start gap-2">
        <div>
          <div className="font-medium text-[#1b1c1c]">{role.name}</div>
          {role.description && <div className="text-xs text-[#707975] mt-0.5">{role.description}</div>}
        </div>
        {!role.is_system && (
          <button type="button" onClick={() => setEditing(true)} className="text-[#707975] hover:text-[#00342b] shrink-0" title="Edit role">
            <Pencil size={14} />
          </button>
        )}
      </div>
    );
  }

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);
    const result = await updateRoleDetails(role.id, { name, description });
    setSubmitting(false);
    if (result.success) {
      setEditing(false);
      onSaved();
    } else {
      setError(result.message ?? 'Failed to save.');
    }
  };

  return (
    <div className="flex flex-col gap-1.5 min-w-[220px]">
      <input value={name} onChange={(e) => setName(e.target.value)} className="border border-[#bfc9c4] px-2 py-1 text-xs" />
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="border border-[#bfc9c4] px-2 py-1 text-xs" />
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={submitting} className="text-xs font-medium text-white bg-[#00342b] px-2 py-1 disabled:opacity-60">
          {submitting ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-[#707975] px-2 py-1">Cancel</button>
      </div>
    </div>
  );
}

function ActiveToggle({ role, onSaved }: { role: Role; onSaved: () => void }) {
  const [pending, setPending] = useState(false);
  const locked = role.is_system;

  const handleClick = async () => {
    setPending(true);
    await setRoleActive(role.id, !role.is_active);
    setPending(false);
    onSaved();
  };

  if (locked) {
    return <span className="text-xs text-[#707975]">Protected</span>;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={`text-xs font-medium px-2.5 py-1.5 border transition-colors disabled:opacity-60 whitespace-nowrap ${
        role.is_active ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-[#00342b] text-[#00342b] hover:bg-[#00342b] hover:text-white'
      }`}
    >
      {pending ? 'Saving...' : role.is_active ? 'Deactivate' : 'Activate'}
    </button>
  );
}

export default function RoleManagementPanel({
  roles,
  assignedCounts,
  canManage,
}: {
  roles: Role[];
  assignedCounts: Record<string, number>;
  canManage: boolean;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="mb-8 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-semibold text-[#00342b]">Roles</h2>
          <p className="text-sm text-[#707975] mt-1">
            {roles.length} role{roles.length === 1 ? '' : 's'} — {roles.filter((r) => r.is_system).length} protected default,{' '}
            {roles.filter((r) => !r.is_system).length} custom.
          </p>
        </div>
        {canManage && <NewRoleForm roles={roles} onCreated={refresh} />}
      </div>

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Assigned Users</th>
              <th className="px-4 py-3">Status</th>
              {canManage && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3] align-top">
                <td className="px-4 py-3">
                  {canManage ? (
                    <EditRoleRow role={role} onSaved={refresh} />
                  ) : (
                    <>
                      <div className="font-medium text-[#1b1c1c]">{role.name}</div>
                      {role.description && <div className="text-xs text-[#707975] mt-0.5">{role.description}</div>}
                    </>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${role.is_system ? 'bg-[#eeeeee] text-[#3f4945]' : 'bg-[#dcf5e3] text-[#1b7a3d]'}`}>
                    {role.is_system ? 'Default' : 'Custom'}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{assignedCounts[role.id] ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${role.is_active ? 'bg-[#dcf5e3] text-[#1b7a3d]' : 'bg-[#eeeeee] text-[#3f4945]'}`}>
                    {role.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <ActiveToggle role={role} onSaved={refresh} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
