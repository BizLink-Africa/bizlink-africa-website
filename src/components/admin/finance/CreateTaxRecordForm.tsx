'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { TAX_CATEGORIES, type TaxCategory } from '@/data/finance';
import { createTaxRecord } from '@/app/admin/(protected)/finance/tax-records/actions';

const initialForm = {
  taxPeriod: '',
  taxCategory: TAX_CATEGORIES[0].value as TaxCategory,
  taxableAmount: 0,
  taxAmount: 0,
  reference: '',
  notes: '',
};

export default function CreateTaxRecordForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createTaxRecord(form);
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to create tax record.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> New Tax Record
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">New Tax Record</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="taxPeriod">Tax Period</label>
          <input id="taxPeriod" value={form.taxPeriod} onChange={(e) => setForm((p) => ({ ...p, taxPeriod: e.target.value }))} placeholder="e.g. 2026-07" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="taxCategory">Category</label>
          <select id="taxCategory" value={form.taxCategory} onChange={(e) => setForm((p) => ({ ...p, taxCategory: e.target.value as TaxCategory }))} className={inputClass}>
            {TAX_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="taxableAmount">Taxable Amount</label>
          <input id="taxableAmount" type="number" min={0} step="0.01" value={form.taxableAmount} onChange={(e) => setForm((p) => ({ ...p, taxableAmount: Number(e.target.value) || 0 }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="taxAmount">Tax Amount</label>
          <input id="taxAmount" type="number" min={0} step="0.01" value={form.taxAmount} onChange={(e) => setForm((p) => ({ ...p, taxAmount: Number(e.target.value) || 0 }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="reference">Reference</label>
          <input id="reference" value={form.reference} onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="notes">Notes</label>
          <textarea id="notes" rows={2} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className={`${inputClass} resize-none`} />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Creating...' : 'Create Tax Record'}
      </button>
    </form>
  );
}
