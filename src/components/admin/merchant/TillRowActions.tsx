'use client';

import { useState } from 'react';
import { updateMerchantTill } from '@/app/admin/(protected)/merchant-operations/tills/actions';
import { MERCHANT_TILL_STATUSES } from '@/data/merchantOperations';

export default function TillRowActions({
  tillId,
  merchantId,
  status,
  partnerTillReference,
}: {
  tillId: string;
  merchantId: string;
  status: string;
  partnerTillReference: string | null;
}) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [reference, setReference] = useState(partnerTillReference ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);
    const result = await updateMerchantTill(tillId, merchantId, { status: currentStatus, partnerTillReference: reference });
    setSubmitting(false);
    if (!result.success) {
      setError(result.message ?? 'Failed to update till.');
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
      <select
        value={currentStatus}
        onChange={(e) => setCurrentStatus(e.target.value)}
        className="border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none"
      >
        {MERCHANT_TILL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <input
        type="text"
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        placeholder="Partner till reference"
        className="border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none w-40"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={submitting}
        className="text-xs font-medium text-white bg-[#00342b] px-3 py-1.5 hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Save'}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
