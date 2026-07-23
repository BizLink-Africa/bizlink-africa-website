'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createEmailCampaign } from '@/app/admin/(protected)/marketing/email-campaigns/actions';

interface CampaignOption {
  id: string;
  name: string;
}

const initialForm = {
  subject: '',
  audienceDescription: '',
  campaignId: '',
  sentDate: '',
  sentCount: 0,
  deliveredCount: 0,
  openedCount: 0,
  clickedCount: 0,
  leads: 0,
  conversions: 0,
  unsubscribes: 0,
};

export default function CreateEmailCampaignForm({ campaigns }: { campaigns: CampaignOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericFields = new Set(['sentCount', 'deliveredCount', 'openedCount', 'clickedCount', 'leads', 'conversions', 'unsubscribes']);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: numericFields.has(name) ? Number(value) || 0 : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await createEmailCampaign({ ...form, campaignId: form.campaignId || undefined });
    setSubmitting(false);
    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to create email campaign.');
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors">
        <Plus size={14} /> New Email Campaign
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">New Email Campaign</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]"><X size={18} /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="subject">Subject</label>
          <input id="subject" name="subject" value={form.subject} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="campaignId">Campaign</label>
          <select id="campaignId" name="campaignId" value={form.campaignId} onChange={handleChange} className={inputClass}>
            <option value="">None</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="audienceDescription">Audience</label>
          <input id="audienceDescription" name="audienceDescription" value={form.audienceDescription} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="sentDate">Sent Date</label>
          <input id="sentDate" name="sentDate" type="date" value={form.sentDate} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="sentCount">Sent Count</label>
          <input id="sentCount" name="sentCount" type="number" min={0} value={form.sentCount} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="deliveredCount">Delivered Count</label>
          <input id="deliveredCount" name="deliveredCount" type="number" min={0} value={form.deliveredCount} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="openedCount">Opened Count</label>
          <input id="openedCount" name="openedCount" type="number" min={0} value={form.openedCount} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="clickedCount">Clicked Count</label>
          <input id="clickedCount" name="clickedCount" type="number" min={0} value={form.clickedCount} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="leads">Leads</label>
          <input id="leads" name="leads" type="number" min={0} value={form.leads} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="conversions">Conversions</label>
          <input id="conversions" name="conversions" type="number" min={0} value={form.conversions} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="unsubscribes">Unsubscribes</label>
          <input id="unsubscribes" name="unsubscribes" type="number" min={0} value={form.unsubscribes} onChange={handleChange} className={inputClass} />
        </div>
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
      <button type="submit" disabled={submitting} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {submitting ? 'Saving...' : 'Create Email Campaign'}
      </button>
    </form>
  );
}
