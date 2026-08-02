'use client';

import { useState } from 'react';
import { requestManualAdjustment } from '@/app/admin/(protected)/merchant-operations/collections/actions';
import { flagTransactionUnderReview } from '@/app/admin/(protected)/merchant-operations/reconciliation/actions';

export default function TransactionRowActions({
  transactionId,
  canManage,
  canReconcile,
}: {
  transactionId: string;
  canManage: boolean;
  canReconcile: boolean;
}) {
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!canManage && !canReconcile) return null;

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await requestManualAdjustment(transactionId, amount, reason);
    setPending(false);
    if (!result.success) {
      setError(result.message ?? 'Failed to submit.');
      return;
    }
    setMessage('Adjustment requested — pending approval.');
    setShowAdjustForm(false);
    setAmount('');
    setReason('');
  };

  const handleFlag = async () => {
    const notes = window.prompt('Notes for the unresolved-item queue (optional):') ?? '';
    setPending(true);
    setError(null);
    const result = await flagTransactionUnderReview(transactionId, notes);
    setPending(false);
    if (!result.success) setError(result.message ?? 'Failed to flag.');
    else setMessage('Flagged for review.');
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 flex-wrap">
        {canManage && (
          <button type="button" onClick={() => setShowAdjustForm((v) => !v)} disabled={pending} className="text-xs font-medium text-[#00342b] border border-[#00342b] px-2.5 py-1 hover:bg-[#00342b] hover:text-white transition-colors disabled:opacity-60">
            Request Adjustment
          </button>
        )}
        {canReconcile && (
          <button type="button" onClick={handleFlag} disabled={pending} className="text-xs font-medium text-[#8a5a00] border border-[#8a5a00] px-2.5 py-1 hover:bg-[#8a5a00] hover:text-white transition-colors disabled:opacity-60">
            Flag for Review
          </button>
        )}
      </div>
      {showAdjustForm && (
        <form onSubmit={handleAdjustSubmit} className="flex items-center gap-2 mt-1">
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (e.g. -5.00)"
            required
            className="border border-[#bfc9c4] px-2 py-1 text-xs w-28 focus:border-[#00342b] focus:outline-none"
          />
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason"
            required
            className="border border-[#bfc9c4] px-2 py-1 text-xs flex-1 focus:border-[#00342b] focus:outline-none"
          />
          <button type="submit" disabled={pending} className="text-xs font-medium text-white bg-[#00342b] px-2.5 py-1 hover:bg-[#004d40] transition-colors disabled:opacity-60">
            Submit
          </button>
        </form>
      )}
      {message && <p className="text-xs text-[#1b7a3d]">{message}</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
