'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateNotificationSettings, type NotificationSettingsInput } from '@/app/admin/(protected)/settings/notification-settings/actions';

const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export default function NotificationSettingsForm({ initial }: { initial: NotificationSettingsInput }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await updateNotificationSettings(form);
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
      <label className="flex items-center gap-2 cursor-pointer text-sm text-[#1b1c1c]">
        <input type="checkbox" checked={form.broadcastEnabled} onChange={(e) => setForm((p) => ({ ...p, broadcastEnabled: e.target.checked }))} className="accent-[#00342b]" />
        Allow staff with permission to broadcast in-app notifications
      </label>

      <div>
        <label className={labelClass} htmlFor="defaultPriority">Default Priority</label>
        <select
          id="defaultPriority"
          value={form.defaultPriority}
          onChange={(e) => setForm((p) => ({ ...p, defaultPriority: e.target.value }))}
          className="w-full max-w-xs border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
        >
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
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
