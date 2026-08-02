'use client';

import { useState } from 'react';
import { setMerchantComplianceHold } from '@/app/admin/(protected)/merchant-operations/actions';

export default function MerchantComplianceHoldPanel({
  merchantId,
  hold,
  reason,
  canManage,
}: {
  merchantId: string;
  hold: boolean;
  reason: string | null;
  canManage: boolean;
}) {
  const [reasonInput, setReasonInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePlaceHold = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await setMerchantComplianceHold(merchantId, true, reasonInput);
    setSubmitting(false);
    if (!result.success) {
      setError(result.message ?? 'Failed to place compliance hold.');
      return;
    }
    setReasonInput('');
  };

  const handleRelease = async () => {
    setSubmitting(true);
    setError(null);
    const result = await setMerchantComplianceHold(merchantId, false);
    setSubmitting(false);
    if (!result.success) {
      setError(result.message ?? 'Failed to release compliance hold.');
    }
  };

  if (!canManage) {
    return (
      <p className="text-sm text-[#1b1c1c]">
        {hold ? `On hold${reason ? `: ${reason}` : ''}` : 'No hold in place'}
      </p>
    );
  }

  return (
    <div>
      {hold ? (
        <div>
          <p className="text-sm text-[#8a1f1f] mb-3">On hold{reason ? `: ${reason}` : ''}</p>
          <button
            type="button"
            onClick={handleRelease}
            disabled={submitting}
            className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors disabled:opacity-60"
          >
            {submitting ? 'Releasing…' : 'Release Hold'}
          </button>
        </div>
      ) : (
        <form onSubmit={handlePlaceHold} className="space-y-3">
          <textarea
            value={reasonInput}
            onChange={(e) => setReasonInput(e.target.value)}
            rows={2}
            placeholder="Reason for compliance hold…"
            className="w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none resize-none"
          />
          <button
            type="submit"
            disabled={submitting || !reasonInput.trim()}
            className="text-sm font-medium text-white bg-[#8a1f1f] px-4 py-2 hover:bg-[#6f1919] transition-colors disabled:opacity-60"
          >
            {submitting ? 'Placing…' : 'Place Compliance Hold'}
          </button>
        </form>
      )}
      {error && <p className="text-xs text-red-700 mt-2">{error}</p>}
    </div>
  );
}
