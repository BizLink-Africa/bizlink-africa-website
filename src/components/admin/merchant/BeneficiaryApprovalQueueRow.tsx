'use client';

import { useState } from 'react';
import { approveBeneficiaryChangeRequest, rejectBeneficiaryChangeRequest } from '@/app/admin/(protected)/merchant-operations/beneficiaries/actions';

export default function BeneficiaryApprovalQueueRow({
  requestId,
  merchantId,
  requestType,
  isOwnRequest,
}: {
  requestId: string;
  merchantId: string;
  requestType: string;
  isOwnRequest: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleApprove = async () => {
    setPending(true);
    setError(null);
    const result = await approveBeneficiaryChangeRequest(requestId, merchantId, requestType);
    setPending(false);
    if (result.success) setDone(true);
    else setError(result.message ?? 'Failed to approve.');
  };

  const handleReject = async () => {
    const notes = window.prompt('Reason for rejecting this request (required):');
    if (!notes || !notes.trim()) return;
    setPending(true);
    setError(null);
    const result = await rejectBeneficiaryChangeRequest(requestId, merchantId, notes);
    setPending(false);
    if (result.success) setDone(true);
    else setError(result.message ?? 'Failed to reject.');
  };

  if (done) return <span className="text-xs text-[#707975] italic">Reviewed.</span>;

  if (isOwnRequest) {
    return <span className="text-xs text-[#707975] italic">You proposed this — a different reviewer must approve it.</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleApprove}
        disabled={pending}
        className="text-xs font-medium text-white bg-[#00342b] px-3 py-1.5 hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        Approve
      </button>
      <button
        type="button"
        onClick={handleReject}
        disabled={pending}
        className="text-xs font-medium text-[#8a1f1f] border border-[#8a1f1f] px-3 py-1.5 hover:bg-[#8a1f1f] hover:text-white transition-colors disabled:opacity-60"
      >
        Reject
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
