'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateMarketingSettings, type MarketingSettingsInput } from '@/app/admin/(protected)/settings/marketing/actions';
import { DEFAULT_CHANNEL_OPTIONS } from '@/data/marketing';

const REPORTING_PREFERENCES = ['weekly', 'monthly', 'quarterly'] as const;

export default function MarketingSettingsForm({ initial }: { initial: MarketingSettingsInput }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const toggleChannel = (channel: string) => {
    setForm((prev) => ({
      ...prev,
      defaultChannels: prev.defaultChannels.includes(channel)
        ? prev.defaultChannels.filter((c) => c !== channel)
        : [...prev.defaultChannels, channel],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await updateMarketingSettings(form);
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
      <div>
        <label className={labelClass}>Default Channels</label>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_CHANNEL_OPTIONS.map((channel) => (
            <label key={channel} className="flex items-center gap-1.5 border border-[#bfc9c4] px-2.5 py-1.5 text-xs cursor-pointer has-[:checked]:bg-[#e0f2ee] has-[:checked]:border-[#00342b]">
              <input type="checkbox" checked={form.defaultChannels.includes(channel)} onChange={() => toggleChannel(channel)} />
              {channel.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="reportingPreference">Reporting Preference</label>
        <select
          id="reportingPreference"
          value={form.reportingPreference}
          onChange={(e) => setForm((p) => ({ ...p, reportingPreference: e.target.value }))}
          className="w-full max-w-xs border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
        >
          {REPORTING_PREFERENCES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
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
