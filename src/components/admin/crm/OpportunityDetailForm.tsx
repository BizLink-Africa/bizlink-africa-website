'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateOpportunity } from '@/app/admin/(protected)/crm/opportunities/actions';
import StaffPicker, { type StaffOption } from './StaffPicker';

export default function OpportunityDetailForm({
  id,
  initialEstimatedValue,
  initialProbability,
  initialExpectedCloseDate,
  initialOwnerUserId,
  initialNextAction,
  initialCompetitorNotes,
  staff,
}: {
  id: string;
  initialEstimatedValue: number;
  initialProbability: number;
  initialExpectedCloseDate: string;
  initialOwnerUserId: string;
  initialNextAction: string;
  initialCompetitorNotes: string;
  staff: StaffOption[];
}) {
  const router = useRouter();
  const [estimatedValue, setEstimatedValue] = useState(String(initialEstimatedValue));
  const [probability, setProbability] = useState(String(initialProbability));
  const [expectedCloseDate, setExpectedCloseDate] = useState(initialExpectedCloseDate);
  const [ownerUserId, setOwnerUserId] = useState(initialOwnerUserId);
  const [nextAction, setNextAction] = useState(initialNextAction);
  const [competitorNotes, setCompetitorNotes] = useState(initialCompetitorNotes);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await updateOpportunity(id, {
      estimatedValue: Number(estimatedValue) || 0,
      probability: Number(probability) || 0,
      expectedCloseDate: expectedCloseDate || null,
      ownerUserId: ownerUserId || null,
      nextAction: nextAction || null,
      competitorNotes: competitorNotes || null,
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
      <h2 className="font-semibold text-[#00342b]">Opportunity Details</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="estimatedValue">Estimated Value</label>
          <input id="estimatedValue" type="number" min={0} value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="probability">Probability (%)</label>
          <input id="probability" type="number" min={0} max={100} value={probability} onChange={(e) => setProbability(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="expectedCloseDate">Expected Close Date</label>
          <input id="expectedCloseDate" type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="ownerUserId">Owner</label>
          <StaffPicker id="ownerUserId" value={ownerUserId} onChange={setOwnerUserId} staff={staff} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="nextAction">Next Action</label>
          <input id="nextAction" value={nextAction} onChange={(e) => setNextAction(e.target.value)} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="competitorNotes">Competitor Notes</label>
          <textarea id="competitorNotes" rows={3} value={competitorNotes} onChange={(e) => setCompetitorNotes(e.target.value)} className={inputClass} />
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
