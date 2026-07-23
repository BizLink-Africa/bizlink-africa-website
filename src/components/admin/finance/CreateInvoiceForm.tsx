'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { FEE_FIELDS, computeTotals, formatMoney, type FeeFieldKey } from '@/data/finance';
import { createInvoice, type InvoiceInput } from '@/app/admin/(protected)/finance/invoices/actions';

interface Defaults {
  currency: string;
  taxPercentage: number;
  paymentTermsDays: number;
}

const emptyFees = FEE_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: 0 }), {} as Record<FeeFieldKey, number>);

export default function CreateInvoiceForm({ defaults }: { defaults: Defaults }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + defaults.paymentTermsDays);
  const dueDateDefault = dueDate.toISOString().slice(0, 10);

  const [form, setForm] = useState({
    clientBusinessName: '',
    clientAddress: '',
    clientEmail: '',
    clientPhone: '',
    serviceSummary: '',
    ...emptyFees,
    otherChargesDescription: '',
    currency: defaults.currency,
    discount: 0,
    tax_percentage: defaults.taxPercentage,
    issueDate: today,
    dueDate: dueDateDefault,
    paymentTerms: `Net ${defaults.paymentTermsDays} days`,
    notes: '',
  });

  const totals = computeTotals(form);

  const handleText = (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [name]: e.target.value }));

  const handleNumber = (name: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [name]: Number(e.target.value) || 0 }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createInvoice(form as InvoiceInput);
    setSubmitting(false);

    if (result.success && result.id) {
      router.push(`/admin/finance/invoices/${result.id}`);
    } else {
      setError(result.message ?? 'Failed to create invoice.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> New Invoice
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">New Invoice</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="clientBusinessName">Client Business Name</label>
          <input id="clientBusinessName" value={form.clientBusinessName} onChange={handleText('clientBusinessName')} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="clientEmail">Client Email</label>
          <input id="clientEmail" type="email" value={form.clientEmail} onChange={handleText('clientEmail')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="clientPhone">Client Phone</label>
          <input id="clientPhone" value={form.clientPhone} onChange={handleText('clientPhone')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="clientAddress">Client Address</label>
          <input id="clientAddress" value={form.clientAddress} onChange={handleText('clientAddress')} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="serviceSummary">Service Summary</label>
          <input id="serviceSummary" value={form.serviceSummary} onChange={handleText('serviceSummary')} className={inputClass} />
        </div>
      </div>

      <div className="border-t border-[#bfc9c4] pt-4">
        <p className={labelClass}>Fees ({form.currency})</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
          {FEE_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="block text-xs text-[#707975] mb-1" htmlFor={field.key}>{field.label}</label>
              <input
                id={field.key}
                type="number"
                min={0}
                step="0.01"
                value={form[field.key]}
                onChange={handleNumber(field.key)}
                className={inputClass}
              />
            </div>
          ))}
        </div>
        {form.other_charges > 0 && (
          <div className="mt-3">
            <label className="block text-xs text-[#707975] mb-1" htmlFor="otherChargesDescription">Other Charges Description</label>
            <input id="otherChargesDescription" value={form.otherChargesDescription} onChange={handleText('otherChargesDescription')} className={inputClass} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className={labelClass} htmlFor="discount">Discount</label>
          <input id="discount" type="number" min={0} step="0.01" value={form.discount} onChange={handleNumber('discount')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="tax_percentage">Tax / VAT (%)</label>
          <input id="tax_percentage" type="number" min={0} step="0.01" value={form.tax_percentage} onChange={handleNumber('tax_percentage')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="issueDate">Issue Date</label>
          <input id="issueDate" type="date" value={form.issueDate} onChange={handleText('issueDate')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="dueDate">Due Date</label>
          <input id="dueDate" type="date" value={form.dueDate} onChange={handleText('dueDate')} className={inputClass} />
        </div>
      </div>

      <div className="bg-[#f5f3f3] border border-[#bfc9c4] p-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <p><span className="text-[#707975]">Subtotal:</span> <span className="font-medium">{formatMoney(totals.subtotal, form.currency)}</span></p>
        <p><span className="text-[#707975]">Tax:</span> <span className="font-medium">{formatMoney(totals.taxAmount, form.currency)}</span></p>
        <p><span className="text-[#707975]">Total:</span> <span className="font-semibold text-[#00342b]">{formatMoney(totals.total, form.currency)}</span></p>
      </div>

      <div>
        <label className={labelClass} htmlFor="notes">Notes</label>
        <textarea id="notes" rows={2} value={form.notes} onChange={handleText('notes')} className={`${inputClass} resize-none`} />
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Creating...' : 'Create Invoice'}
      </button>
    </form>
  );
}
