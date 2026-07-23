'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateEmailSettings, type EmailSettingsInput } from '@/app/admin/(protected)/settings/email/actions';

export default function EmailSettingsForm({ initial }: { initial: EmailSettingsInput }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await updateEmailSettings(form);
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
          <label className={labelClass} htmlFor="senderName">Sender Name</label>
          <input id="senderName" value={form.senderName} onChange={(e) => setForm((p) => ({ ...p, senderName: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="senderAddress">Sender Address</label>
          <input id="senderAddress" type="email" value={form.senderAddress} onChange={(e) => setForm((p) => ({ ...p, senderAddress: e.target.value }))} className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Templates</label>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#1b1c1c]">
            <input type="checkbox" checked={form.proformaEnabled} onChange={(e) => setForm((p) => ({ ...p, proformaEnabled: e.target.checked }))} className="accent-[#00342b]" />
            Proforma email
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#1b1c1c]">
            <input type="checkbox" checked={form.invoiceEnabled} onChange={(e) => setForm((p) => ({ ...p, invoiceEnabled: e.target.checked }))} className="accent-[#00342b]" />
            Invoice email
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#1b1c1c]">
            <input type="checkbox" checked={form.contractEnabled} onChange={(e) => setForm((p) => ({ ...p, contractEnabled: e.target.checked }))} className="accent-[#00342b]" />
            Contract email
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#1b1c1c]">
            <input type="checkbox" checked={form.supportEnabled} onChange={(e) => setForm((p) => ({ ...p, supportEnabled: e.target.checked }))} className="accent-[#00342b]" />
            Support email
          </label>
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
