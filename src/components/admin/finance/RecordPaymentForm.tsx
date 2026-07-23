'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { recordInvoicePayment } from '@/app/admin/(protected)/finance/invoices/actions';

export default function RecordPaymentForm({ invoiceId, outstandingBalance, currency }: { invoiceId: string; outstandingBalance: number; currency: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState(outstandingBalance);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('');
  const [reference, setReference] = useState('');
  const [receiptReference, setReceiptReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await recordInvoicePayment(invoiceId, { amount, paymentDate, paymentMethod, reference, receiptReference });
    setSubmitting(false);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to record payment.');
    }
  };

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  if (outstandingBalance <= 0) {
    return <p className="text-sm text-[#1b7a3d]">This invoice is fully paid.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className={labelClass} htmlFor="amount">Amount ({currency})</label>
          <input
            id="amount"
            type="number"
            min={0.01}
            step="0.01"
            max={outstandingBalance}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="paymentDate">Payment Date</label>
          <input id="paymentDate" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="paymentMethod">Method</label>
          <input id="paymentMethod" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="Bank transfer, mobile money..." className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="reference">Reference</label>
          <input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="receiptReference">Receipt Reference</label>
          <input id="receiptReference" value={receiptReference} onChange={(e) => setReceiptReference(e.target.value)} className={inputClass} />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Recording...' : 'Record Payment'}
      </button>
    </form>
  );
}
