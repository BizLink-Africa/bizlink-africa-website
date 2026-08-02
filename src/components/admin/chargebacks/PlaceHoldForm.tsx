'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { placeSettlementHold } from '@/app/admin/(protected)/chargebacks/actions';

const inputClass = 'border border-[#bfc9c4] px-3 py-2 text-sm w-full focus:border-[#00342b] focus:outline-none';
const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

export default function PlaceHoldForm({
  merchants,
  transactions,
}: {
  merchants: { id: string; business_name: string }[];
  transactions: { id: string; provider_transaction_reference: string; merchant_id: string }[];
}) {
  const router = useRouter();
  const [merchantId, setMerchantId] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [holdAmount, setHoldAmount] = useState('0');
  const [expiresAt, setExpiresAt] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await placeSettlementHold(merchantId, transactionId || null, null, holdReason, holdAmount, expiresAt || null);
    setPending(false);
    if (!result.success) {
      setError(result.message ?? 'Failed to place the hold.');
      return;
    }
    router.push('/admin/chargebacks/holds');
  }

  const filteredTransactions = merchantId ? transactions.filter((t) => t.merchant_id === merchantId) : transactions;

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-6 space-y-4 max-w-xl">
      <div>
        <label className={labelClass}>Merchant</label>
        <select value={merchantId} onChange={(e) => { setMerchantId(e.target.value); setTransactionId(''); }} required className={inputClass}>
          <option value="" disabled>Select a merchant…</option>
          {merchants.map((m) => <option key={m.id} value={m.id}>{m.business_name}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>Transaction (optional — blank means a blanket hold on all this merchant&apos;s settlements)</label>
        <select value={transactionId} onChange={(e) => setTransactionId(e.target.value)} className={inputClass}>
          <option value="">All transactions (blanket hold)</option>
          {filteredTransactions.map((t) => <option key={t.id} value={t.id}>{t.provider_transaction_reference}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Hold Amount (optional)</label>
          <input type="text" value={holdAmount} onChange={(e) => setHoldAmount(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Expires At (optional)</label>
          <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Hold Reason (required)</label>
        <textarea value={holdReason} onChange={(e) => setHoldReason(e.target.value)} required rows={3} className={inputClass} />
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">{error}</p>}
      <button type="submit" disabled={pending} className="text-sm font-medium text-white bg-[#00342b] px-5 py-2.5 hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {pending ? 'Placing…' : 'Place Hold'}
      </button>
    </form>
  );
}
