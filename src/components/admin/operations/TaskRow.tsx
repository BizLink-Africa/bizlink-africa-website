'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp } from 'lucide-react';
import InlineSelect from '@/components/admin/InlineSelect';
import Pill, { PRIORITY_TONES } from '@/components/admin/operations/Pill';
import { updateOperationalTaskStatus, updateOperationalTaskDetails } from '@/app/admin/(protected)/operations/tasks/actions';
import type { StaffOption } from '@/components/admin/crm/StaffPicker';
import { TASK_STATUSES, labelFor, type OperationalTask } from '@/data/operations';

export default function TaskRow({
  task,
  staff,
  clientName,
  readOnly,
}: {
  task: OperationalTask;
  staff: StaffOption[];
  clientName: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [assignedUserId, setAssignedUserId] = useState(task.assigned_user_id ?? '');
  const [blocker, setBlocker] = useState(task.blocker ?? '');
  const [notes, setNotes] = useState(task.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const staffNameById = new Map(staff.map((s) => [s.id, s.full_name]));
  const statusOptions = TASK_STATUSES.map((s) => ({ value: s.value, label: s.label }));
  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';

  const handleSaveDetails = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await updateOperationalTaskDetails(task.id, { assignedUserId: assignedUserId || undefined, blocker, notes });
    setSaving(false);
    setFeedback(result.success ? 'Saved.' : result.message ?? 'Failed to save.');
    if (result.success) router.refresh();
  };

  return (
    <>
      <tr className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
        <td className="px-4 py-3 font-medium text-[#1b1c1c]">{task.task_number} — {task.title}</td>
        <td className="px-4 py-3 text-[#3f4945]">{clientName}</td>
        <td className="px-4 py-3"><Pill label={task.priority} tone={PRIORITY_TONES[task.priority] ?? 'neutral'} /></td>
        <td className="px-4 py-3 text-[#3f4945]">{task.assigned_user_id ? staffNameById.get(task.assigned_user_id) ?? '—' : '—'}</td>
        <td className="px-4 py-3 text-[#3f4945]">{task.due_date ?? '—'}</td>
        <td className="px-4 py-3">
          {readOnly ? (
            <Pill label={labelFor(TASK_STATUSES, task.status)} tone="neutral" />
          ) : (
            <InlineSelect value={task.status} options={statusOptions} onSave={(v) => updateOperationalTaskStatus(task.id, v as OperationalTask['status'])} />
          )}
        </td>
        <td className="px-4 py-3">
          <button type="button" onClick={() => setExpanded((v) => !v)} className="text-[#00342b] hover:text-[#004d40]">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-[#e5e5e5] bg-[#f9faf9]">
          <td colSpan={7} className="px-4 py-4">
            {readOnly ? (
              <div className="text-sm text-[#3f4945] space-y-1">
                <p><span className="font-semibold text-[#707975]">Blocker:</span> {task.blocker ?? '—'}</p>
                <p><span className="font-semibold text-[#707975]">Notes:</span> {task.notes ?? '—'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)} className={inputClass}>
                  <option value="">Unassigned</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
                <input value={blocker} onChange={(e) => setBlocker(e.target.value)} placeholder="Blocker" className={inputClass} />
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className={inputClass} />
                <button
                  type="button"
                  onClick={handleSaveDetails}
                  disabled={saving}
                  className="sm:col-span-3 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60 w-fit"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                {feedback && <p className="sm:col-span-3 text-xs text-[#707975]">{feedback}</p>}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
