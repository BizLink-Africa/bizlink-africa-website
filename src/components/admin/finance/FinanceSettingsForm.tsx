'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateFinanceSettings, type FinanceSettingsInput } from '@/app/admin/(protected)/finance/settings/actions';

export default function FinanceSettingsForm({ initial }: { initial: FinanceSettingsInput }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await updateFinanceSettings(form);
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
        <h2 className="font-semibold text-[#00342b]">Finance Settings</h2>
        <p className="text-xs text-[#707975] mt-1">
          The CEO-approval threshold below is the same value shown on the Expenses page — expenses over this amount
          require both CFO and CEO approval before they can be marked approved.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="defaultCurrency">Default Currency</label>
          <input id="defaultCurrency" value={form.defaultCurrency} onChange={(e) => setForm((p) => ({ ...p, defaultCurrency: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="vatPercentage">VAT Percentage</label>
          <input id="vatPercentage" type="number" min={0} max={100} step="0.01" value={form.vatPercentage} onChange={(e) => setForm((p) => ({ ...p, vatPercentage: Number(e.target.value) || 0 }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="invoicePrefix">Invoice Number Prefix</label>
          <input id="invoicePrefix" value={form.invoicePrefix} onChange={(e) => setForm((p) => ({ ...p, invoicePrefix: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="proformaPrefix">Proforma Number Prefix</label>
          <input id="proformaPrefix" value={form.proformaPrefix} onChange={(e) => setForm((p) => ({ ...p, proformaPrefix: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="defaultPaymentTermsDays">Default Payment Terms (days)</label>
          <input id="defaultPaymentTermsDays" type="number" min={0} value={form.defaultPaymentTermsDays} onChange={(e) => setForm((p) => ({ ...p, defaultPaymentTermsDays: Number(e.target.value) || 0 }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="expenseHighValueThreshold">Expense CEO-Approval Threshold</label>
          <input id="expenseHighValueThreshold" type="number" min={0} step="0.01" value={form.expenseHighValueThreshold} onChange={(e) => setForm((p) => ({ ...p, expenseHighValueThreshold: Number(e.target.value) || 0 }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="financialYearStartMonth">Financial Year Start Month</label>
          <select id="financialYearStartMonth" value={form.financialYearStartMonth} onChange={(e) => setForm((p) => ({ ...p, financialYearStartMonth: Number(e.target.value) }))} className={inputClass}>
            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((label, i) => (
              <option key={label} value={i + 1}>{label}</option>
            ))}
          </select>
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
