'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateCampaignDetails } from '@/app/admin/(protected)/marketing/campaigns/actions';
import type { StaffOption } from '@/components/admin/crm/StaffPicker';

export default function CampaignDetailForm({
  id,
  currency,
  initialBudget,
  initialActualSpend,
  initialOwnerUserId,
  initialTargetAudience,
  initialNotes,
  staff,
}: {
  id: string;
  currency: string;
  initialBudget: number;
  initialActualSpend: number;
  initialOwnerUserId: string;
  initialTargetAudience: string;
  initialNotes: string;
  staff: StaffOption[];
}) {
  const router = useRouter();
  const [budget, setBudget] = useState(String(initialBudget));
  const [actualSpend, setActualSpend] = useState(String(initialActualSpend));
  const [ownerUserId, setOwnerUserId] = useState(initialOwnerUserId);
  const [targetAudience, setTargetAudience] = useState(initialTargetAudience);
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await updateCampaignDetails(id, {
      budget: Number(budget) || 0,
      actualSpend: Number(actualSpend) || 0,
      ownerUserId: ownerUserId || undefined,
      targetAudience: targetAudience || undefined,
      notes: notes || undefined,
    });
    setSaving(false);
    if (result.success) {
      setFeedback({ type: 'success', text: 'Saved.' });
      router.refresh();
    } else {
      setFeedback({ type: 'error', text: result.message ?? 'Failed to save.' });
    }
  };

  return (
    <div className="bg-white border border-[#bfc9c4] p-6 space-y-4">
      <h2 className="font-semibold text-[#00342b]">Campaign Details</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="budget">Budget ({currency})</label>
          <input id="budget" type="number" min={0} step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="actualSpend">Actual Spend ({currency})</label>
          <input id="actualSpend" type="number" min={0} step="0.01" value={actualSpend} onChange={(e) => setActualSpend(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="ownerUserId">Owner</label>
          <select id="ownerUserId" value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} className={inputClass}>
            <option value="">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="targetAudience">Target Audience</label>
          <input id="targetAudience" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="notes">Notes</label>
          <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} resize-none`} />
        </div>
      </div>
      {feedback && (
        <p className={`text-sm px-3 py-2 border ${feedback.type === 'success' ? 'text-[#00342b] bg-[#e0f2ee] border-[#afefdd]' : 'text-red-700 bg-red-50 border-red-200'}`}>
          {feedback.text}
        </p>
      )}
      <button onClick={handleSave} disabled={saving} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}
