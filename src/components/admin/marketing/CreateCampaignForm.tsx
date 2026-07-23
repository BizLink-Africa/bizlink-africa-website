'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { CAMPAIGN_CHANNELS, CAMPAIGN_TYPES, type CampaignChannel, type CampaignType } from '@/data/marketing';
import { createCampaign, type CampaignInput } from '@/app/admin/(protected)/marketing/campaigns/actions';
import type { StaffOption } from '@/components/admin/crm/StaffPicker';

const initialForm = {
  name: '',
  type: '' as CampaignType | '',
  channels: [] as CampaignChannel[],
  objective: '',
  startDate: '',
  endDate: '',
  budget: 0,
  actualSpend: 0,
  targetAudience: '',
  ownerUserId: '',
  description: '',
};

export default function CreateCampaignForm({ currency, staff }: { currency: string; staff: StaffOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: name === 'budget' || name === 'actualSpend' ? Number(value) || 0 : value }));
  };

  const toggleChannel = (channel: CampaignChannel) => {
    setForm((prev) => ({
      ...prev,
      channels: prev.channels.includes(channel) ? prev.channels.filter((c) => c !== channel) : [...prev.channels, channel],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createCampaign({ ...form, type: form.type || undefined, currency } as CampaignInput);
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to create campaign.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> New Campaign
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">New Campaign</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="name">Campaign Name</label>
          <input id="name" name="name" value={form.name} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="type">Type</label>
          <select id="type" name="type" value={form.type} onChange={handleChange} className={inputClass}>
            <option value="">Not set</option>
            {CAMPAIGN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className="sm:col-span-3">
          <label className={labelClass}>Channels</label>
          <div className="flex flex-wrap gap-2">
            {CAMPAIGN_CHANNELS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => toggleChannel(c.value)}
                className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                  form.channels.includes(c.value) ? 'bg-[#00342b] text-white border-[#00342b]' : 'text-[#3f4945] border-[#bfc9c4] hover:bg-[#f5f3f3]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="sm:col-span-3">
          <label className={labelClass} htmlFor="objective">Goal</label>
          <input id="objective" name="objective" value={form.objective} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="budget">Budget ({currency})</label>
          <input id="budget" name="budget" type="number" min={0} step="0.01" value={form.budget} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="actualSpend">Actual Spend ({currency})</label>
          <input id="actualSpend" name="actualSpend" type="number" min={0} step="0.01" value={form.actualSpend} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="ownerUserId">Owner</label>
          <select id="ownerUserId" name="ownerUserId" value={form.ownerUserId} onChange={handleChange} className={inputClass}>
            <option value="">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="startDate">Start Date</label>
          <input id="startDate" name="startDate" type="date" value={form.startDate} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="endDate">End Date</label>
          <input id="endDate" name="endDate" type="date" value={form.endDate} onChange={handleChange} className={inputClass} />
        </div>
        <div className="sm:col-span-3">
          <label className={labelClass} htmlFor="targetAudience">Target Audience</label>
          <input id="targetAudience" name="targetAudience" value={form.targetAudience} onChange={handleChange} className={inputClass} />
        </div>
        <div className="sm:col-span-3">
          <label className={labelClass} htmlFor="description">Notes</label>
          <textarea id="description" name="description" value={form.description} onChange={handleChange} rows={3} className={inputClass} />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Creating...' : 'Create Campaign'}
      </button>
    </form>
  );
}
