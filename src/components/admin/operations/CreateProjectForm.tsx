'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createProject, type ProjectInput } from '@/app/admin/(protected)/operations/projects/actions';
import { SERVICE_CATALOG } from '@/data/services';
import type { StaffOption } from '@/components/admin/crm/StaffPicker';

interface Option {
  id: string;
  business_name?: string;
  contract_number?: string;
}

const initialForm = {
  projectName: '',
  clientId: '',
  serviceKey: '',
  contractId: '',
  projectOwner: '',
  startDate: '',
  targetCompletionDate: '',
};

export default function CreateProjectForm({ clients, contracts, staff }: { clients: Option[]; contracts: Option[]; staff: StaffOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createProject(form as ProjectInput);
    setSubmitting(false);

    if (result.success && result.id) {
      router.push(`/admin/operations/projects/${result.id}`);
    } else {
      setError(result.message ?? 'Failed to create project.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> New Project
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">New Project</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="projectName">Project Name</label>
          <input id="projectName" name="projectName" value={form.projectName} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="clientId">Client</label>
          <select id="clientId" name="clientId" value={form.clientId} onChange={handleChange} className={inputClass}>
            <option value="">No linked client</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="serviceKey">Service</label>
          <select id="serviceKey" name="serviceKey" value={form.serviceKey} onChange={handleChange} className={inputClass}>
            <option value="">None</option>
            {SERVICE_CATALOG.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="contractId">Contract</label>
          <select id="contractId" name="contractId" value={form.contractId} onChange={handleChange} className={inputClass}>
            <option value="">None</option>
            {contracts.map((c) => <option key={c.id} value={c.id}>{c.contract_number}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="projectOwner">Project Owner</label>
          <select id="projectOwner" name="projectOwner" value={form.projectOwner} onChange={handleChange} className={inputClass}>
            <option value="">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="startDate">Start Date</label>
          <input id="startDate" name="startDate" type="date" value={form.startDate} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="targetCompletionDate">Target Completion Date</label>
          <input id="targetCompletionDate" name="targetCompletionDate" type="date" value={form.targetCompletionDate} onChange={handleChange} className={inputClass} />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Creating...' : 'Create Project'}
      </button>
    </form>
  );
}
