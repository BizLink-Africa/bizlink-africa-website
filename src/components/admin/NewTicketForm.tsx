'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { TICKET_CATEGORIES, DEPARTMENTS, type Department } from '@/data/tickets';
import { PRIORITY_LEVELS } from '@/data/inquiries';
import { createTicket } from '@/app/admin/(protected)/support-tickets/actions';
import type { StaffOption } from '@/components/admin/crm/StaffPicker';

const initialForm = {
  title: '',
  description: '',
  clientId: '',
  contactPerson: '',
  contactEmail: '',
  category: TICKET_CATEGORIES[0].value as string,
  priority: 'normal',
  department: '' as Department | '',
  assignedUserId: '',
};

export default function NewTicketForm({ clients, staff }: { clients: Array<{ id: string; client_name: string; business_name: string }>; staff: StaffOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createTicket({ ...form, department: form.department || undefined });
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to create ticket.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> New Ticket
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">New Ticket</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="title">Ticket Title</label>
          <input
            id="title"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            required
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="description">Description</label>
          <textarea
            id="description"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            className={`${inputClass} resize-none`}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="clientId">Client</label>
          <select
            id="clientId"
            value={form.clientId}
            onChange={(e) => setForm((prev) => ({ ...prev, clientId: e.target.value }))}
            className={inputClass}
          >
            <option value="">No client linked</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.client_name} — {c.business_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="contactPerson">Contact Person</label>
          <input id="contactPerson" value={form.contactPerson} onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="contactEmail">Contact Email</label>
          <input id="contactEmail" type="email" value={form.contactEmail} onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="category">Category</label>
          <select
            id="category"
            value={form.category}
            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            className={inputClass}
          >
            {TICKET_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="priority">Priority</label>
          <select
            id="priority"
            value={form.priority}
            onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
            className={inputClass}
          >
            {PRIORITY_LEVELS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="department">Department</label>
          <select id="department" value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value as Department }))} className={inputClass}>
            <option value="">Not set</option>
            {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="assignedUserId">Assigned Agent</label>
          <select id="assignedUserId" value={form.assignedUserId} onChange={(e) => setForm((p) => ({ ...p, assignedUserId: e.target.value }))} className={inputClass}>
            <option value="">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Creating...' : 'Create Ticket'}
      </button>
    </form>
  );
}
