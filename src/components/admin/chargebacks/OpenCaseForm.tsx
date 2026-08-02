'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { openChargebackCase } from '@/app/admin/(protected)/chargebacks/actions';
import { CHARGEBACK_REASONS } from '@/data/chargebacks';

const inputClass = 'border border-[#bfc9c4] px-3 py-2 text-sm w-full focus:border-[#00342b] focus:outline-none';
const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

export default function OpenCaseForm({ transactions }: { transactions: { id: string; provider_transaction_reference: string; gross_amount: string }[] }) {
  const router = useRouter();
  const [transactionId, setTransactionId] = useState('');
  const [disputedAmount, setDisputedAmount] = useState('');
  const [associatedFee, setAssociatedFee] = useState('0');
  const [reason, setReason] = useState<string>(CHARGEBACK_REASONS[0].value);
  const [evidenceDueAt, setEvidenceDueAt] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await openChargebackCase(transactionId, disputedAmount, associatedFee, reason, evidenceDueAt || null);
    setPending(false);
    if (!result.success || !result.id) {
      setError(result.message ?? 'Failed to open the case.');
      return;
    }
    router.push(`/admin/chargebacks/${result.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-6 space-y-4 max-w-xl">
      <div>
        <label className={labelClass}>Transaction</label>
        <select value={transactionId} onChange={(e) => setTransactionId(e.target.value)} required className={inputClass}>
          <option value="" disabled>Select a transaction…</option>
          {transactions.map((t) => (
            <option key={t.id} value={t.id}>{t.provider_transaction_reference} — {t.gross_amount}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Disputed Amount</label>
          <input type="text" value={disputedAmount} onChange={(e) => setDisputedAmount(e.target.value)} placeholder="e.g. 100000.00" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Associated Fee</label>
          <input type="text" value={associatedFee} onChange={(e) => setAssociatedFee(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Reason</label>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass}>
          {CHARGEBACK_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>Evidence Due Date (optional)</label>
        <input type="datetime-local" value={evidenceDueAt} onChange={(e) => setEvidenceDueAt(e.target.value)} className={inputClass} />
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">{error}</p>}
      <button type="submit" disabled={pending} className="text-sm font-medium text-white bg-[#00342b] px-5 py-2.5 hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {pending ? 'Opening…' : 'Open Case'}
      </button>
    </form>
  );
}
