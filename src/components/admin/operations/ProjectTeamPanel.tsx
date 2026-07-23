'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { addProjectTeamMember, removeProjectTeamMember } from '@/app/admin/(protected)/operations/projects/actions';
import type { StaffOption } from '@/components/admin/crm/StaffPicker';

interface TeamMember {
  id: string;
  staff_id: string;
  role_on_project: string | null;
}

export default function ProjectTeamPanel({
  projectId,
  members,
  staff,
  readOnly,
}: {
  projectId: string;
  members: TeamMember[];
  staff: StaffOption[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [staffId, setStaffId] = useState('');
  const [role, setRole] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const staffNameById = new Map(staff.map((s) => [s.id, s.full_name]));

  const handleAdd = async () => {
    if (!staffId) {
      setError('Select a staff member.');
      return;
    }
    setPending(true);
    setError(null);
    const result = await addProjectTeamMember(projectId, staffId, role);
    setPending(false);
    if (result.success) {
      setStaffId('');
      setRole('');
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to add team member.');
    }
  };

  const handleRemove = async (memberId: string) => {
    setPending(true);
    const result = await removeProjectTeamMember(projectId, memberId);
    setPending(false);
    if (result.success) router.refresh();
    else setError(result.message ?? 'Failed to remove team member.');
  };

  return (
    <div className="bg-white border border-[#bfc9c4] p-6">
      <h2 className="font-semibold text-[#00342b] mb-3">Team</h2>
      {members.length === 0 ? (
        <p className="text-sm text-[#707975] mb-3">No team members assigned yet.</p>
      ) : (
        <ul className="divide-y divide-[#e5e5e5] mb-3">
          {members.map((m) => (
            <li key={m.id} className="py-2 flex items-center justify-between text-sm">
              <span>{staffNameById.get(m.staff_id) ?? 'Unknown'} {m.role_on_project && <span className="text-[#707975]">— {m.role_on_project}</span>}</span>
              {!readOnly && (
                <button type="button" onClick={() => handleRemove(m.id)} disabled={pending} className="text-[#707975] hover:text-red-700">
                  <X size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div className="flex flex-wrap gap-2 items-end">
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none">
            <option value="">Add staff...</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Role (optional)"
            className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
          />
          <button type="button" onClick={handleAdd} disabled={pending} className="bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
            Add
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 mt-2">{error}</p>}
    </div>
  );
}
