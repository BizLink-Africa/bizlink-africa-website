'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { COMMUNICATION_TYPES } from '@/data/crm';
import { createFollowUp, type FollowUpInput } from '@/app/admin/(protected)/crm/follow-ups/actions';
import StaffPicker, { type StaffOption } from './StaffPicker';

interface EntityOption {
  id: string;
  label: string;
}

const initialForm = {
  followUpDate: new Date().toISOString().slice(0, 10),
  linkType: 'lead' as 'lead' | 'client',
  linkedId: '',
  assignedUserId: '',
  communicationType: COMMUNICATION_TYPES[0].value as string,
  purpose: '',
};

export default function CreateFollowUpForm({ staff, leads, clients }: { staff: StaffOption[]; leads: EntityOption[]; clients: EntityOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const input: FollowUpInput = {
      followUpDate: form.followUpDate,
      leadId: form.linkType === 'lead' ? form.linkedId : undefined,
      clientId: form.linkType === 'client' ? form.linkedId : undefined,
      assignedUserId: form.assignedUserId || undefined,
      communicationType: form.communicationType,
      purpose: form.purpose,
    };
    const result = await createFollowUp(input);
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to create follow-up.');
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors">
        <Plus size={14} /> New Follow-up
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';
  const options = form.linkType === 'lead' ? leads : clients;

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">New Follow-up</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass} htmlFor="linkType">Link To</label>
          <select id="linkType" value={form.linkType} onChange={(e) => setForm((p) => ({ ...p, linkType: e.target.value as 'lead' | 'client', linkedId: '' }))} className={inputClass}>
            <option value="lead">Lead</option>
            <option value="client">Client</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="linkedId">{form.linkType === 'lead' ? 'Lead' : 'Client'}</label>
          <select id="linkedId" value={form.linkedId} onChange={(e) => setForm((p) => ({ ...p, linkedId: e.target.value }))} required className={inputClass}>
            <option value="">Select…</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="followUpDate">Follow-up Date</label>
          <input id="followUpDate" type="date" value={form.followUpDate} onChange={(e) => setForm((p) => ({ ...p, followUpDate: e.target.value }))} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="communicationType">Communication Type</label>
          <select id="communicationType" value={form.communicationType} onChange={(e) => setForm((p) => ({ ...p, communicationType: e.target.value }))} className={inputClass}>
            {COMMUNICATION_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="assignedUserId">Assigned To</label>
          <StaffPicker id="assignedUserId" value={form.assignedUserId} onChange={(value) => setForm((p) => ({ ...p, assignedUserId: value }))} staff={staff} className={inputClass} />
        </div>
        <div className="sm:col-span-3">
          <label className={labelClass} htmlFor="purpose">Purpose</label>
          <input id="purpose" value={form.purpose} onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))} className={inputClass} />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button type="submit" disabled={submitting} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {submitting ? 'Creating...' : 'Create Follow-up'}
      </button>
    </form>
  );
}
