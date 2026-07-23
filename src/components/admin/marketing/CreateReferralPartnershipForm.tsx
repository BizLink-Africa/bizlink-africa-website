'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createReferralPartnership } from '@/app/admin/(protected)/marketing/referrals/actions';
import type { ReferralPartnershipType } from '@/data/marketing';

interface CampaignOption {
  id: string;
  name: string;
}

export default function CreateReferralPartnershipForm({ type, label, campaigns }: { type: ReferralPartnershipType; label: string; campaigns: CampaignOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [referrerOrPartnerName, setReferrerOrPartnerName] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await createReferralPartnership({ type, referrerOrPartnerName, campaignId: campaignId || undefined, notes: notes || undefined });
    setSubmitting(false);
    if (result.success) {
      setReferrerOrPartnerName('');
      setCampaignId('');
      setNotes('');
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to create.');
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors">
        <Plus size={14} /> New {label}
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">New {label}</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]"><X size={18} /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="referrerOrPartnerName">{type === 'referral' ? 'Referrer Name' : 'Partner Name'}</label>
          <input id="referrerOrPartnerName" value={referrerOrPartnerName} onChange={(e) => setReferrerOrPartnerName(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="campaignId">Related Campaign</label>
          <select id="campaignId" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={inputClass}>
            <option value="">None</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="notes">Notes</label>
          <textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} resize-none`} />
        </div>
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
      <button type="submit" disabled={submitting} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {submitting ? 'Creating...' : `Create ${label}`}
      </button>
    </form>
  );
}
