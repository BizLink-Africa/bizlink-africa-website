'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateSlaRule } from '@/app/admin/(protected)/support/settings/actions';
import { labelFor } from '@/data/tickets';
import { PRIORITY_LEVELS } from '@/data/inquiries';

export default function SlaRuleRow({ priority, initialResponseHours, initialResolutionHours }: { priority: string; initialResponseHours: number; initialResolutionHours: number }) {
  const router = useRouter();
  const [responseHours, setResponseHours] = useState(String(initialResponseHours));
  const [resolutionHours, setResolutionHours] = useState(String(initialResolutionHours));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const inputClass = 'w-24 border border-[#bfc9c4] px-2 py-1.5 text-sm focus:border-[#00342b] focus:outline-none';

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await updateSlaRule(priority, Number(responseHours) || 0, Number(resolutionHours) || 0);
    setSaving(false);
    setFeedback(result.success ? 'Saved' : result.message ?? 'Failed');
    if (result.success) router.refresh();
  };

  return (
    <tr className="border-b border-[#e5e5e5] last:border-0">
      <td className="py-2 text-[#3f4945] capitalize">{labelFor(PRIORITY_LEVELS, priority)}</td>
      <td className="py-2"><input type="number" min={1} value={responseHours} onChange={(e) => setResponseHours(e.target.value)} className={inputClass} /> h</td>
      <td className="py-2"><input type="number" min={1} value={resolutionHours} onChange={(e) => setResolutionHours(e.target.value)} className={inputClass} /> h</td>
      <td className="py-2">
        <button type="button" onClick={handleSave} disabled={saving} className="bg-[#00342b] text-white px-3 py-1.5 text-xs font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
          {saving ? 'Saving...' : 'Save'}
        </button>
        {feedback && <span className="ml-2 text-xs text-[#707975]">{feedback}</span>}
      </td>
    </tr>
  );
}
