'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createResourceAllocation } from '@/app/admin/(protected)/operations/resources/actions';
import type { StaffOption } from '@/components/admin/crm/StaffPicker';

interface ProjectOption {
  id: string;
  project_name: string;
}

export default function AllocateStaffForm({ staff, projects }: { staff: StaffOption[]; projects: ProjectOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [allocationPercent, setAllocationPercent] = useState('50');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createResourceAllocation({
      staffId,
      projectId: projectId || undefined,
      allocationPercent: Number(allocationPercent) || 0,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
    setSubmitting(false);

    if (result.success) {
      setOpen(false);
      setStaffId('');
      setProjectId('');
      setAllocationPercent('50');
      setStartDate('');
      setEndDate('');
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to save allocation.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> Allocate Staff
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">Allocate Staff to Project</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="staffId">Staff</label>
          <select id="staffId" value={staffId} onChange={(e) => setStaffId(e.target.value)} required className={inputClass}>
            <option value="">Select staff...</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="projectId">Project</label>
          <select id="projectId" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass}>
            <option value="">General (no project)</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="allocationPercent">Allocation (%)</label>
          <input id="allocationPercent" type="number" min={1} max={100} value={allocationPercent} onChange={(e) => setAllocationPercent(e.target.value)} className={inputClass} />
        </div>
        <div />
        <div>
          <label className={labelClass} htmlFor="startDate">Start Date</label>
          <input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="endDate">End Date</label>
          <input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Saving...' : 'Allocate'}
      </button>
    </form>
  );
}
