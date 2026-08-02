'use client';

import { useState } from 'react';
import { reviewManualAdjustment } from '@/app/admin/(protected)/merchant-operations/collections/actions';

export default function ReviewAdjustmentButtons({ adjustmentId, transactionId }: { adjustmentId: string; transactionId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleApprove = async () => {
    setPending(true);
    setError(null);
    const result = await reviewManualAdjustment(adjustmentId, transactionId, 'approve', '');
    setPending(false);
    if (result.success) setDone(true);
    else setError(result.message ?? 'Failed to approve.');
  };

  const handleReject = async () => {
    const notes = window.prompt('Reason for rejecting this adjustment (required):');
    if (!notes || !notes.trim()) return;
    setPending(true);
    setError(null);
    const result = await reviewManualAdjustment(adjustmentId, transactionId, 'reject', notes);
    setPending(false);
    if (result.success) setDone(true);
    else setError(result.message ?? 'Failed to reject.');
  };

  if (done) return <span className="text-xs text-[#707975] italic">Reviewed.</span>;

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={handleApprove} disabled={pending} className="text-xs font-medium text-white bg-[#00342b] px-3 py-1.5 hover:bg-[#004d40] transition-colors disabled:opacity-60">
        Approve
      </button>
      <button type="button" onClick={handleReject} disabled={pending} className="text-xs font-medium text-[#8a1f1f] border border-[#8a1f1f] px-3 py-1.5 hover:bg-[#8a1f1f] hover:text-white transition-colors disabled:opacity-60">
        Reject
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
