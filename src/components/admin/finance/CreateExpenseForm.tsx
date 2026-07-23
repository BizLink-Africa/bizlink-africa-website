'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { EXPENSE_CATEGORIES } from '@/data/finance';
import { createExpense, type ExpenseInput } from '@/app/admin/(protected)/finance/expenses/actions';

const initialForm = {
  category: EXPENSE_CATEGORIES[0].value,
  description: '',
  vendor: '',
  amount: 0,
  currency: 'TZS',
  expenseDate: new Date().toISOString().slice(0, 10),
  paymentMethod: '',
  reference: '',
  receiptReference: '',
  department: '',
  notes: '',
};

export default function CreateExpenseForm({ currency }: { currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...initialForm, currency });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: name === 'amount' ? Number(value) || 0 : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createExpense(form as ExpenseInput);
    setSubmitting(false);

    if (result.success) {
      setForm({ ...initialForm, currency });
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to create expense.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> New Expense
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">New Expense</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass} htmlFor="category">Category</label>
          <select id="category" name="category" value={form.category} onChange={handleChange} className={inputClass}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="description">Description</label>
          <input id="description" name="description" value={form.description} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="vendor">Vendor</label>
          <input id="vendor" name="vendor" value={form.vendor} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="amount">Amount ({form.currency})</label>
          <input id="amount" name="amount" type="number" min={0.01} step="0.01" value={form.amount} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="expenseDate">Expense Date</label>
          <input id="expenseDate" name="expenseDate" type="date" value={form.expenseDate} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="paymentMethod">Payment Method</label>
          <input id="paymentMethod" name="paymentMethod" value={form.paymentMethod} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="reference">Reference</label>
          <input id="reference" name="reference" value={form.reference} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="receiptReference">Receipt Reference</label>
          <input id="receiptReference" name="receiptReference" value={form.receiptReference} onChange={handleChange} placeholder="Filed/stored where?" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="department">Department</label>
          <input id="department" name="department" value={form.department} onChange={handleChange} className={inputClass} />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Submitting...' : 'Submit Expense'}
      </button>
    </form>
  );
}
