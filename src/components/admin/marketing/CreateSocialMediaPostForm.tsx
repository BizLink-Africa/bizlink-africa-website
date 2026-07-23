'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/data/marketing';
import { createSocialMediaPost } from '@/app/admin/(protected)/marketing/social/actions';

interface CampaignOption {
  id: string;
  name: string;
}

const initialForm = { platform: SOCIAL_PLATFORMS[0].value as SocialPlatform, campaignId: '', postReference: '', postedDate: '', reach: 0, engagement: 0, clicks: 0, leads: 0, conversions: 0 };

export default function CreateSocialMediaPostForm({ campaigns }: { campaigns: CampaignOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericFields = new Set(['reach', 'engagement', 'clicks', 'leads', 'conversions']);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: numericFields.has(name) ? Number(value) || 0 : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await createSocialMediaPost({ ...form, campaignId: form.campaignId || undefined });
    setSubmitting(false);
    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to log post.');
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors">
        <Plus size={14} /> Log Post
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">Log Social Media Post</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]"><X size={18} /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass} htmlFor="platform">Platform</label>
          <select id="platform" name="platform" value={form.platform} onChange={handleChange} className={inputClass}>
            {SOCIAL_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="campaignId">Campaign</label>
          <select id="campaignId" name="campaignId" value={form.campaignId} onChange={handleChange} className={inputClass}>
            <option value="">None</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="postedDate">Posted Date</label>
          <input id="postedDate" name="postedDate" type="date" value={form.postedDate} onChange={handleChange} className={inputClass} />
        </div>
        <div className="sm:col-span-3">
          <label className={labelClass} htmlFor="postReference">Post Reference (URL or ID)</label>
          <input id="postReference" name="postReference" value={form.postReference} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="reach">Reach</label>
          <input id="reach" name="reach" type="number" min={0} value={form.reach} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="engagement">Engagement</label>
          <input id="engagement" name="engagement" type="number" min={0} value={form.engagement} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="clicks">Clicks</label>
          <input id="clicks" name="clicks" type="number" min={0} value={form.clicks} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="leads">Leads</label>
          <input id="leads" name="leads" type="number" min={0} value={form.leads} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="conversions">Conversions</label>
          <input id="conversions" name="conversions" type="number" min={0} value={form.conversions} onChange={handleChange} className={inputClass} />
        </div>
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
      <button type="submit" disabled={submitting} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {submitting ? 'Saving...' : 'Log Post'}
      </button>
    </form>
  );
}
