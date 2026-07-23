'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { LEAD_SOURCES, type LeadSource } from '@/data/inquiries';
import { createMarketingLead } from '@/app/admin/(protected)/marketing/leads/actions';

interface CampaignOption {
  id: string;
  name: string;
}

const initialForm = { fullName: '', businessName: '', email: '', phone: '', businessType: '', location: '', leadSource: '' as LeadSource | '', campaignId: '' };

export default function CreateMarketingLeadForm({ campaigns }: { campaigns: CampaignOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateLeadId, setDuplicateLeadId] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setDuplicateLeadId(null);

    const result = await createMarketingLead({ ...form, leadSource: form.leadSource || undefined, campaignId: form.campaignId || undefined });
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to create lead.');
      setDuplicateLeadId(result.duplicateLeadId ?? null);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> New Marketing Lead
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">New Marketing Lead</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass} htmlFor="fullName">Contact Person</label>
          <input id="fullName" name="fullName" value={form.fullName} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="businessName">Business Name</label>
          <input id="businessName" name="businessName" value={form.businessName} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="businessType">Business Type</label>
          <input id="businessType" name="businessType" value={form.businessType} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="email">Email</label>
          <input id="email" name="email" type="email" value={form.email} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="phone">Phone</label>
          <input id="phone" name="phone" value={form.phone} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="location">Location</label>
          <input id="location" name="location" value={form.location} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="leadSource">Lead Source</label>
          <select id="leadSource" name="leadSource" value={form.leadSource} onChange={handleChange} className={inputClass}>
            <option value="">Not set</option>
            {LEAD_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="campaignId">Campaign</label>
          <select id="campaignId" name="campaignId" value={form.campaignId} onChange={handleChange} className={inputClass}>
            <option value="">None</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}{' '}
          {duplicateLeadId && (
            <Link href={`/admin/inquiries/${duplicateLeadId}`} className="underline font-medium">
              View existing lead →
            </Link>
          )}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Creating...' : 'Create Lead'}
      </button>
    </form>
  );
}
