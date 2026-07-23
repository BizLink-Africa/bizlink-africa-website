'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createMilestone } from '@/app/admin/(protected)/operations/milestones/actions';
import type { StaffOption } from '@/components/admin/crm/StaffPicker';

interface ProjectOption {
  id: string;
  project_name: string;
}

export default function CreateMilestoneForm({
  projects,
  staff,
  defaultProjectId,
}: {
  projects: ProjectOption[];
  staff: StaffOption[];
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(defaultProjectId ?? '');
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dependencies, setDependencies] = useState('');
  const [acceptanceRequirement, setAcceptanceRequirement] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createMilestone({
      projectId,
      title,
      owner: owner || undefined,
      dueDate: dueDate || undefined,
      dependencies: dependencies.split('\n'),
      acceptanceRequirement: acceptanceRequirement || undefined,
    });
    setSubmitting(false);

    if (result.success) {
      setOpen(false);
      setTitle('');
      setOwner('');
      setDueDate('');
      setDependencies('');
      setAcceptanceRequirement('');
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to create milestone.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> New Milestone
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">New Delivery Milestone</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="projectId">Project</label>
          <select id="projectId" value={projectId} onChange={(e) => setProjectId(e.target.value)} required className={inputClass}>
            <option value="">Select project...</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="title">Title</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="owner">Owner</label>
          <select id="owner" value={owner} onChange={(e) => setOwner(e.target.value)} className={inputClass}>
            <option value="">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="dueDate">Due Date</label>
          <input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="dependencies">Dependencies (one per line)</label>
          <textarea id="dependencies" rows={2} value={dependencies} onChange={(e) => setDependencies(e.target.value)} className={`${inputClass} resize-none`} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="acceptanceRequirement">Acceptance Requirement</label>
          <textarea id="acceptanceRequirement" rows={2} value={acceptanceRequirement} onChange={(e) => setAcceptanceRequirement(e.target.value)} className={`${inputClass} resize-none`} />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Creating...' : 'Create Milestone'}
      </button>
    </form>
  );
}
