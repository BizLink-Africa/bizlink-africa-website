'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { prepareSettlementBatch } from '@/app/admin/(protected)/settlement/actions';

export default function PrepareBatchForm({ merchants }: { merchants: { id: string; business_name: string }[] }) {
  const router = useRouter();
  const [settlementDate, setSettlementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [merchantId, setMerchantId] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await prepareSettlementBatch(settlementDate, merchantId || null);
    setPending(false);
    if (!result.success || !result.batchId) {
      setError(result.message ?? 'Failed to prepare the batch.');
      return;
    }
    router.push(`/admin/settlement/${result.batchId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-6 space-y-4 max-w-xl">
      <div>
        <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Settlement Date</label>
        <input
          type="date"
          value={settlementDate}
          onChange={(e) => setSettlementDate(e.target.value)}
          required
          className="border border-[#bfc9c4] px-3 py-2 text-sm w-full focus:border-[#00342b] focus:outline-none"
        />
        <p className="text-xs text-[#707975] mt-1">Includes every reconciled, not-yet-batched transaction collected on or before this date.</p>
      </div>
      <div>
        <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Merchant (optional — leave blank for all eligible merchants)</label>
        <select value={merchantId} onChange={(e) => setMerchantId(e.target.value)} className="border border-[#bfc9c4] px-3 py-2 text-sm w-full focus:border-[#00342b] focus:outline-none">
          <option value="">All eligible merchants</option>
          {merchants.map((m) => <option key={m.id} value={m.id}>{m.business_name}</option>)}
        </select>
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">{error}</p>}
      <button type="submit" disabled={pending} className="text-sm font-medium text-white bg-[#00342b] px-5 py-2.5 hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {pending ? 'Preparing…' : 'Prepare Batch'}
      </button>
    </form>
  );
}
