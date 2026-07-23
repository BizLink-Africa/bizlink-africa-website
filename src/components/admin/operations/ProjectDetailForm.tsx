'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateProjectDetails } from '@/app/admin/(protected)/operations/projects/actions';
import type { StaffOption } from '@/components/admin/crm/StaffPicker';
import { PROJECT_STATUSES, type ProjectStatus } from '@/data/operations';

export default function ProjectDetailForm({
  id,
  initialStatus,
  initialProgress,
  initialProjectOwner,
  initialTargetCompletionDate,
  initialRisks,
  initialBlockers,
  initialNotes,
  staff,
}: {
  id: string;
  initialStatus: ProjectStatus;
  initialProgress: number;
  initialProjectOwner: string;
  initialTargetCompletionDate: string;
  initialRisks: string;
  initialBlockers: string;
  initialNotes: string;
  staff: StaffOption[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [progress, setProgress] = useState(String(initialProgress));
  const [projectOwner, setProjectOwner] = useState(initialProjectOwner);
  const [targetCompletionDate, setTargetCompletionDate] = useState(initialTargetCompletionDate);
  const [risks, setRisks] = useState(initialRisks);
  const [blockers, setBlockers] = useState(initialBlockers);
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await updateProjectDetails(id, {
      status,
      progress: Number(progress) || 0,
      projectOwner: projectOwner || undefined,
      targetCompletionDate: targetCompletionDate || undefined,
      risks: risks || undefined,
      blockers: blockers || undefined,
      notes: notes || undefined,
    });
    setSaving(false);
    if (result.success) {
      setFeedback({ type: 'success', text: 'Saved.' });
      router.refresh();
    } else {
      setFeedback({ type: 'error', text: result.message ?? 'Failed to save.' });
    }
  };

  return (
    <div className="bg-white border border-[#bfc9c4] p-6 space-y-4">
      <h2 className="font-semibold text-[#00342b]">Project Details</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="status">Status</label>
          <select id="status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className={inputClass}>
            {PROJECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="progress">Progress (%)</label>
          <input id="progress" type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="projectOwner">Project Owner</label>
          <select id="projectOwner" value={projectOwner} onChange={(e) => setProjectOwner(e.target.value)} className={inputClass}>
            <option value="">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="targetCompletionDate">Target Completion Date</label>
          <input id="targetCompletionDate" type="date" value={targetCompletionDate} onChange={(e) => setTargetCompletionDate(e.target.value)} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="risks">Risks</label>
          <textarea id="risks" rows={2} value={risks} onChange={(e) => setRisks(e.target.value)} className={`${inputClass} resize-none`} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="blockers">Blockers</label>
          <textarea id="blockers" rows={2} value={blockers} onChange={(e) => setBlockers(e.target.value)} className={`${inputClass} resize-none`} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="notes">Notes</label>
          <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} resize-none`} />
        </div>
      </div>
      {feedback && (
        <p className={`text-sm px-3 py-2 border ${feedback.type === 'success' ? 'text-[#00342b] bg-[#e0f2ee] border-[#afefdd]' : 'text-red-700 bg-red-50 border-red-200'}`}>
          {feedback.text}
        </p>
      )}
      <button onClick={handleSave} disabled={saving} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}
