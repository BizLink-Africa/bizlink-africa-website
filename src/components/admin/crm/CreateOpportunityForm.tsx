'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createOpportunity, type OpportunityInput } from '@/app/admin/(protected)/crm/opportunities/actions';
import { SERVICE_CATALOG } from '@/data/services';
import StaffPicker, { type StaffOption } from './StaffPicker';

interface ClientOption {
  id: string;
  business_name: string;
}

export default function CreateOpportunityForm({
  staff,
  clients,
  leadId,
  defaultName,
  defaultCurrency,
}: {
  staff: StaffOption[];
  clients: ClientOption[];
  leadId?: string;
  defaultName?: string;
  defaultCurrency: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: defaultName ?? '',
    clientId: '',
    relatedService: '',
    estimatedValue: 0,
    currency: defaultCurrency,
    probability: 50,
    expectedCloseDate: '',
    ownerUserId: '',
    competitorNotes: '',
    nextAction: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const input: OpportunityInput = { ...form, leadId };
    const result = await createOpportunity(input);
    setSubmitting(false);

    if (result.success && result.id) {
      router.push(`/admin/crm/opportunities/${result.id}`);
    } else {
      setError(result.message ?? 'Failed to create opportunity.');
    }
  };

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-6 space-y-4 max-w-3xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="name">Opportunity Name</label>
          <input id="name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required className={inputClass} />
        </div>
        {!leadId && (
          <div>
            <label className={labelClass} htmlFor="clientId">Client</label>
            <select id="clientId" value={form.clientId} onChange={(e) => setForm((p) => ({ ...p, clientId: e.target.value }))} className={inputClass}>
              <option value="">Select a client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className={labelClass} htmlFor="relatedService">Related Service</label>
          <select id="relatedService" value={form.relatedService} onChange={(e) => setForm((p) => ({ ...p, relatedService: e.target.value }))} className={inputClass}>
            <option value="">Not set</option>
            {SERVICE_CATALOG.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="estimatedValue">Estimated Value</label>
          <input id="estimatedValue" type="number" min={0} value={form.estimatedValue} onChange={(e) => setForm((p) => ({ ...p, estimatedValue: Number(e.target.value) || 0 }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="currency">Currency</label>
          <input id="currency" value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="probability">Probability (%)</label>
          <input id="probability" type="number" min={0} max={100} value={form.probability} onChange={(e) => setForm((p) => ({ ...p, probability: Number(e.target.value) || 0 }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="expectedCloseDate">Expected Close Date</label>
          <input id="expectedCloseDate" type="date" value={form.expectedCloseDate} onChange={(e) => setForm((p) => ({ ...p, expectedCloseDate: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="ownerUserId">Owner</label>
          <StaffPicker id="ownerUserId" value={form.ownerUserId} onChange={(value) => setForm((p) => ({ ...p, ownerUserId: value }))} staff={staff} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="nextAction">Next Action</label>
          <input id="nextAction" value={form.nextAction} onChange={(e) => setForm((p) => ({ ...p, nextAction: e.target.value }))} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="competitorNotes">Competitor Notes</label>
          <textarea id="competitorNotes" rows={3} value={form.competitorNotes} onChange={(e) => setForm((p) => ({ ...p, competitorNotes: e.target.value }))} className={inputClass} />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button type="submit" disabled={submitting} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {submitting ? 'Creating...' : 'Create Opportunity'}
      </button>
    </form>
  );
}
