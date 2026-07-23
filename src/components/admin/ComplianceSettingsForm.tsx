'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateComplianceSettings, type ComplianceSettingsInput } from '@/app/admin/(protected)/settings/compliance/actions';

export default function ComplianceSettingsForm({ initial }: { initial: ComplianceSettingsInput }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await updateComplianceSettings(form);
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="reviewFrequencyDays">Review Frequency (days)</label>
          <input
            id="reviewFrequencyDays"
            type="number"
            min={1}
            value={form.reviewFrequencyDays}
            onChange={(e) => setForm((p) => ({ ...p, reviewFrequencyDays: Number(e.target.value) }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="policyReviewPeriodDays">Policy Review Period (days)</label>
          <input
            id="policyReviewPeriodDays"
            type="number"
            min={1}
            value={form.policyReviewPeriodDays}
            onChange={(e) => setForm((p) => ({ ...p, policyReviewPeriodDays: Number(e.target.value) }))}
            className={inputClass}
          />
        </div>
      </div>

      {feedback && (
        <p className={`text-sm px-3 py-2 border ${feedback.type === 'success' ? 'text-[#00342b] bg-[#e0f2ee] border-[#afefdd]' : 'text-red-700 bg-red-50 border-red-200'}`}>
          {feedback.text}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}
