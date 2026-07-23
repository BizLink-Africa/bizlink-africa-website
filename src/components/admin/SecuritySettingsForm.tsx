'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateSecuritySettings, type SecuritySettingsInput } from '@/app/admin/(protected)/settings/security/actions';

export default function SecuritySettingsForm({ initial }: { initial: SecuritySettingsInput }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await updateSecuritySettings(form);
    setSaving(false);

    if (result.success) {
      setFeedback({ type: 'success', text: 'Saved.' });
      router.refresh();
    } else {
      setFeedback({ type: 'error', text: result.message ?? 'Failed to save.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#bfc9c4] p-6 space-y-4">
        <h2 className="font-semibold text-[#00342b]">Password Policy</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="passwordMinLength">Minimum Length</label>
            <input id="passwordMinLength" type="number" min={6} value={form.passwordMinLength} onChange={(e) => setForm((p) => ({ ...p, passwordMinLength: Number(e.target.value) }))} className={inputClass} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#1b1c1c]">
            <input type="checkbox" checked={form.passwordRequireUppercase} onChange={(e) => setForm((p) => ({ ...p, passwordRequireUppercase: e.target.checked }))} className="accent-[#00342b]" />
            Require uppercase letter
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#1b1c1c]">
            <input type="checkbox" checked={form.passwordRequireNumber} onChange={(e) => setForm((p) => ({ ...p, passwordRequireNumber: e.target.checked }))} className="accent-[#00342b]" />
            Require number
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#1b1c1c]">
            <input type="checkbox" checked={form.passwordRequireSymbol} onChange={(e) => setForm((p) => ({ ...p, passwordRequireSymbol: e.target.checked }))} className="accent-[#00342b]" />
            Require symbol
          </label>
        </div>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 space-y-4">
        <h2 className="font-semibold text-[#00342b]">MFA & Sessions</h2>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-[#1b1c1c]">
          <input type="checkbox" checked={form.mfaRequired} onChange={(e) => setForm((p) => ({ ...p, mfaRequired: e.target.checked }))} className="accent-[#00342b]" />
          MFA required for all staff
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="sessionTimeoutMinutes">Session Timeout (minutes)</label>
            <input id="sessionTimeoutMinutes" type="number" min={1} value={form.sessionTimeoutMinutes} onChange={(e) => setForm((p) => ({ ...p, sessionTimeoutMinutes: Number(e.target.value) }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="dataRetentionDays">Data Retention (days)</label>
            <input id="dataRetentionDays" type="number" min={1} value={form.dataRetentionDays} onChange={(e) => setForm((p) => ({ ...p, dataRetentionDays: Number(e.target.value) }))} className={inputClass} />
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 space-y-4">
        <h2 className="font-semibold text-[#00342b]">Login Limits & Lockout</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="maxLoginAttempts">Max Login Attempts</label>
            <input id="maxLoginAttempts" type="number" min={1} value={form.maxLoginAttempts} onChange={(e) => setForm((p) => ({ ...p, maxLoginAttempts: Number(e.target.value) }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="lockoutDurationMinutes">Lockout Duration (minutes)</label>
            <input id="lockoutDurationMinutes" type="number" min={1} value={form.lockoutDurationMinutes} onChange={(e) => setForm((p) => ({ ...p, lockoutDurationMinutes: Number(e.target.value) }))} className={inputClass} />
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 space-y-4">
        <h2 className="font-semibold text-[#00342b]">IP Restrictions</h2>
        <div>
          <label className={labelClass} htmlFor="ipAllowlist">Allowlisted IPs / CIDR ranges</label>
          <textarea id="ipAllowlist" rows={3} value={form.ipAllowlist} onChange={(e) => setForm((p) => ({ ...p, ipAllowlist: e.target.value }))} placeholder="One per line" className={inputClass} />
          <p className="text-xs text-[#707975] mt-1">
            Stored for reference — not yet enforced by any middleware. Configuring this list does not currently block access.
          </p>
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
