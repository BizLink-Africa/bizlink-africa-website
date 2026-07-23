'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProposal, type ProposalInput } from '@/app/admin/(protected)/crm/proposals/actions';
import { SERVICE_CATALOG } from '@/data/services';

interface ClientOption {
  id: string;
  business_name: string;
}

export default function CreateProposalForm({
  clients,
  leadId,
  defaultCurrency,
}: {
  clients: ClientOption[];
  leadId?: string;
  defaultCurrency: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    clientId: '',
    services: [] as string[],
    scope: '',
    pricingSummaryTotal: 0,
    currency: defaultCurrency,
    pricingNotes: '',
    validUntil: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleService = (key: string) => {
    setForm((prev) => ({
      ...prev,
      services: prev.services.includes(key) ? prev.services.filter((s) => s !== key) : [...prev.services, key],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const input: ProposalInput = { ...form, leadId };
    const result = await createProposal(input);
    setSubmitting(false);

    if (result.success && result.id) {
      router.push(`/admin/crm/proposals/${result.id}`);
    } else {
      setError(result.message ?? 'Failed to create proposal.');
    }
  };

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-6 space-y-4 max-w-3xl">
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
        <label className={labelClass}>Services</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SERVICE_CATALOG.map((s) => (
            <label key={s.value} className="flex items-center gap-1.5 text-xs text-[#3f4945]">
              <input type="checkbox" checked={form.services.includes(s.value)} onChange={() => toggleService(s.value)} />
              {s.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="scope">Scope</label>
        <textarea id="scope" rows={3} value={form.scope} onChange={(e) => setForm((p) => ({ ...p, scope: e.target.value }))} className={inputClass} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass} htmlFor="pricingSummaryTotal">Pricing Summary Total</label>
          <input
            id="pricingSummaryTotal"
            type="number"
            min={0}
            value={form.pricingSummaryTotal}
            onChange={(e) => setForm((p) => ({ ...p, pricingSummaryTotal: Number(e.target.value) || 0 }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="currency">Currency</label>
          <input id="currency" value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="validUntil">Valid Until</label>
          <input id="validUntil" type="date" value={form.validUntil} onChange={(e) => setForm((p) => ({ ...p, validUntil: e.target.value }))} className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="pricingNotes">Pricing Notes</label>
        <textarea id="pricingNotes" rows={2} value={form.pricingNotes} onChange={(e) => setForm((p) => ({ ...p, pricingNotes: e.target.value }))} className={inputClass} />
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button type="submit" disabled={submitting} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {submitting ? 'Creating...' : 'Create Proposal'}
      </button>
    </form>
  );
}
