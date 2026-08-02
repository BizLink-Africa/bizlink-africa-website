'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { runDailyReconciliation } from '@/app/admin/(protected)/merchant-operations/reconciliation/actions';

export default function ReconciliationRunForm({ merchants }: { merchants: { id: string; business_name: string }[] }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [tillReference, setTillReference] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [vendorAmountReceived, setVendorAmountReceived] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await runDailyReconciliation({
      fromDate,
      toDate,
      tillReference: tillReference || undefined,
      merchantId: merchantId || undefined,
      vendorAmountReceived: vendorAmountReceived || undefined,
    });
    setSubmitting(false);
    if (!result.success) {
      setError(result.message ?? 'Failed to run reconciliation.');
      return;
    }
    router.refresh();
  };

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-6 mb-6 space-y-4">
      <h2 className="font-semibold text-[#00342b]">Run Reconciliation</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="fromDate">From Date</label>
          <input id="fromDate" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="toDate">To Date</label>
          <input id="toDate" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="tillReference">Till Reference (optional)</label>
          <input id="tillReference" value={tillReference} onChange={(e) => setTillReference(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="merchantId">Merchant (optional)</label>
          <select id="merchantId" value={merchantId} onChange={(e) => setMerchantId(e.target.value)} className={inputClass}>
            <option value="">All merchants</option>
            {merchants.map((m) => <option key={m.id} value={m.id}>{m.business_name}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="vendorAmountReceived">Vendor Account Amount Received (optional)</label>
          <input
            id="vendorAmountReceived"
            value={vendorAmountReceived}
            onChange={(e) => setVendorAmountReceived(e.target.value)}
            placeholder="e.g. 12345.67"
            className={inputClass}
          />
          <p className="text-xs text-[#707975] mt-1">Entered manually from the settlement account statement — there is no live vendor-account feed.</p>
        </div>
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
      <button type="submit" disabled={submitting} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {submitting ? 'Running…' : 'Run Reconciliation'}
      </button>
    </form>
  );
}
