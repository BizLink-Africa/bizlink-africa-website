'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { CONTENT_TYPES, type ContentType } from '@/data/marketing';
import { CAMPAIGN_CHANNELS } from '@/data/marketing';
import { createContentCalendarItem } from '@/app/admin/(protected)/marketing/content-calendar/actions';
import type { StaffOption } from '@/components/admin/crm/StaffPicker';

interface CampaignOption {
  id: string;
  name: string;
}

const initialForm = { title: '', channel: '', campaignId: '', contentType: CONTENT_TYPES[0].value as ContentType, plannedDate: '', ownerUserId: '' };

export default function CreateContentItemForm({ campaigns, staff }: { campaigns: CampaignOption[]; staff: StaffOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await createContentCalendarItem({ ...form, channel: form.channel || undefined, campaignId: form.campaignId || undefined, ownerUserId: form.ownerUserId || undefined });
    setSubmitting(false);
    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to create content item.');
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors">
        <Plus size={14} /> New Content Item
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">New Content Item</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]"><X size={18} /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="title">Content Title</label>
          <input id="title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="contentType">Content Type</label>
          <select id="contentType" value={form.contentType} onChange={(e) => setForm((p) => ({ ...p, contentType: e.target.value as ContentType }))} className={inputClass}>
            {CONTENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="channel">Channel</label>
          <select id="channel" value={form.channel} onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))} className={inputClass}>
            <option value="">None</option>
            {CAMPAIGN_CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="campaignId">Campaign</label>
          <select id="campaignId" value={form.campaignId} onChange={(e) => setForm((p) => ({ ...p, campaignId: e.target.value }))} className={inputClass}>
            <option value="">None</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="ownerUserId">Owner</label>
          <select id="ownerUserId" value={form.ownerUserId} onChange={(e) => setForm((p) => ({ ...p, ownerUserId: e.target.value }))} className={inputClass}>
            <option value="">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="plannedDate">Planned Date</label>
          <input id="plannedDate" type="date" value={form.plannedDate} onChange={(e) => setForm((p) => ({ ...p, plannedDate: e.target.value }))} className={inputClass} />
        </div>
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
      <button type="submit" disabled={submitting} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {submitting ? 'Creating...' : 'Create Content Item'}
      </button>
    </form>
  );
}
