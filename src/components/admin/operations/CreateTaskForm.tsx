'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createOperationalTask, type TaskInput } from '@/app/admin/(protected)/operations/tasks/actions';
import type { StaffOption } from '@/components/admin/crm/StaffPicker';
import { TASK_PRIORITIES, type TaskPriority } from '@/data/operations';

interface Option {
  id: string;
  business_name?: string;
  project_name?: string;
  contract_number?: string;
}

const initialForm = {
  title: '',
  description: '',
  clientId: '',
  projectId: '',
  contractId: '',
  assignedUserId: '',
  department: '',
  priority: 'normal' as TaskPriority,
  dueDate: '',
};

export default function CreateTaskForm({
  clients,
  projects,
  contracts,
  staff,
}: {
  clients: Option[];
  projects: Option[];
  contracts: Option[];
  staff: StaffOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createOperationalTask({ ...form, assignedUserId: form.assignedUserId } as TaskInput);
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to create task.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> New Task
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">New Operational Task</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="title">Title</label>
          <input id="title" name="title" value={form.title} onChange={handleChange} required className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="description">Description</label>
          <textarea id="description" name="description" rows={2} value={form.description} onChange={handleChange} className={`${inputClass} resize-none`} />
        </div>
        <div>
          <label className={labelClass} htmlFor="clientId">Client</label>
          <select id="clientId" name="clientId" value={form.clientId} onChange={handleChange} className={inputClass}>
            <option value="">None</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="projectId">Project</label>
          <select id="projectId" name="projectId" value={form.projectId} onChange={handleChange} className={inputClass}>
            <option value="">None</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
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
          <label className={labelClass} htmlFor="assignedUserId">Assigned Staff</label>
          <select id="assignedUserId" name="assignedUserId" value={form.assignedUserId} onChange={handleChange} className={inputClass}>
            <option value="">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="department">Department</label>
          <input id="department" name="department" value={form.department} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="priority">Priority</label>
          <select id="priority" name="priority" value={form.priority} onChange={handleChange} className={inputClass}>
            {TASK_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="dueDate">Due Date</label>
          <input id="dueDate" name="dueDate" type="date" value={form.dueDate} onChange={handleChange} className={inputClass} />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Creating...' : 'Create Task'}
      </button>
    </form>
  );
}
