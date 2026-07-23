'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateContractSettings, type ContractSettingsInput } from '@/app/admin/(protected)/settings/contracts/actions';

const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

export default function ContractSettingsForm({ initial, roleOptions }: { initial: ContractSettingsInput; roleOptions: { value: string; label: string }[] }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const toggleRole = (roleId: string) => {
    setForm((p) => ({
      ...p,
      requiredApprovalRoles: p.requiredApprovalRoles.includes(roleId)
        ? p.requiredApprovalRoles.filter((r) => r !== roleId)
        : [...p.requiredApprovalRoles, roleId],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await updateContractSettings(form);
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
          <label className={labelClass} htmlFor="contractPrefix">Contract Number Prefix</label>
          <input id="contractPrefix" value={form.contractPrefix} onChange={(e) => setForm((p) => ({ ...p, contractPrefix: e.target.value }))} className={inputClass} />
        </div>
        <div />
        <div>
          <label className={labelClass} htmlFor="renewalNoticeDays">Renewal Notice (days before expiry)</label>
          <input id="renewalNoticeDays" type="number" min={0} value={form.renewalNoticeDays} onChange={(e) => setForm((p) => ({ ...p, renewalNoticeDays: Number(e.target.value) || 0 }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="expiryNoticeDays">Expiry Notice (days before expiry)</label>
          <input id="expiryNoticeDays" type="number" min={0} value={form.expiryNoticeDays} onChange={(e) => setForm((p) => ({ ...p, expiryNoticeDays: Number(e.target.value) || 0 }))} className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Required Approval Roles</label>
        <div className="flex flex-wrap gap-3">
          {roleOptions.map((r) => (
            <label key={r.value} className="flex items-center gap-1.5 text-sm text-[#1b1c1c] cursor-pointer">
              <input type="checkbox" checked={form.requiredApprovalRoles.includes(r.value)} onChange={() => toggleRole(r.value)} className="accent-[#00342b]" />
              {r.label}
            </label>
          ))}
        </div>
      </div>

      {feedback && (
        <p className={`text-sm px-3 py-2 border ${feedback.type === 'success' ? 'text-[#00342b] bg-[#e0f2ee] border-[#afefdd]' : 'text-red-700 bg-red-50 border-red-200'}`}>
          {feedback.text}
        </p>
      )}

      <button onClick={handleSave} disabled={saving} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
