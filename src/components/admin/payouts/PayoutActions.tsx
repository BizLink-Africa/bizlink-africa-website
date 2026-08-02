'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  approvePayout,
  cancelPayout,
  submitPayout,
  retryPayout,
  placePayoutHold,
  releasePayoutHold,
  reversePayout,
  checkPayoutProviderStatus,
} from '@/app/admin/(protected)/payouts/actions';
import type { MerchantPayoutStatus } from '@/data/payouts';
import { MAX_PAYOUT_RETRIES } from '@/data/payouts';

export default function PayoutActions({
  payoutId,
  status,
  retryCount,
  canManage,
  canApprove,
  canSubmit,
  canHold,
}: {
  payoutId: string;
  status: MerchantPayoutStatus;
  retryCount: number;
  canManage: boolean;
  canApprove: boolean;
  canSubmit: boolean;
  canHold: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [activeForm, setActiveForm] = useState<'cancel' | 'hold' | 'reverse' | null>(null);

  async function run(action: () => Promise<{ success: boolean; message?: string }>) {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await action();
    setPending(false);
    if (!result.success) {
      setError(result.message ?? 'Action failed.');
      return;
    }
    setActiveForm(null);
    setReason('');
    router.refresh();
  }

  async function handleCheckStatus() {
    setPending(true);
    setError(null);
    const result = await checkPayoutProviderStatus(payoutId);
    setPending(false);
    if (!result.success) {
      setError(result.message ?? 'Failed to check status.');
      return;
    }
    setMessage(`Provider reports: ${result.providerStatus}`);
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">{error}</p>}
      {message && <p className="text-sm text-[#1b7a3d] bg-green-50 border border-green-200 px-4 py-3">{message}</p>}

      <div className="flex flex-wrap gap-2">
        {canApprove && status === 'pending_approval' && (
          <button type="button" disabled={pending} onClick={() => run(() => approvePayout(payoutId))} className="text-sm font-medium text-white bg-[#1b7a3d] px-4 py-2 hover:bg-[#166030] transition-colors disabled:opacity-60">
            Approve
          </button>
        )}

        {(canManage || canApprove) && ['pending_approval', 'approved'].includes(status) && (
          <button type="button" onClick={() => setActiveForm(activeForm === 'cancel' ? null : 'cancel')} className="text-sm font-medium text-[#8a1f1f] border border-[#8a1f1f] px-4 py-2 hover:bg-[#8a1f1f] hover:text-white transition-colors">
            Cancel Before Submission
          </button>
        )}

        {canSubmit && status === 'approved' && (
          <button type="button" disabled={pending} onClick={() => run(() => submitPayout(payoutId))} className="text-sm font-medium text-white bg-[#6b21a8] px-4 py-2 hover:bg-[#581c87] transition-colors disabled:opacity-60">
            {pending ? 'Submitting to Selcom sandbox…' : 'Submit to Selcom Sandbox (SANDBOX — NO LIVE FUNDS)'}
          </button>
        )}

        {canManage && status === 'failed' && retryCount < MAX_PAYOUT_RETRIES && (
          <button type="button" disabled={pending} onClick={() => run(() => retryPayout(payoutId))} className="text-sm font-medium text-white bg-[#8a5a00] px-4 py-2 hover:bg-[#6e4700] transition-colors disabled:opacity-60">
            Retry ({retryCount}/{MAX_PAYOUT_RETRIES} used)
          </button>
        )}

        {canHold && !['successful', 'reversed', 'cancelled', 'held'].includes(status) && (
          <button type="button" onClick={() => setActiveForm(activeForm === 'hold' ? null : 'hold')} className="text-sm font-medium text-[#8a5a00] border border-[#8a5a00] px-4 py-2 hover:bg-[#8a5a00] hover:text-white transition-colors">
            Place on Hold
          </button>
        )}
        {canHold && status === 'held' && (
          <button type="button" disabled={pending} onClick={() => run(() => releasePayoutHold(payoutId, ''))} className="text-sm font-medium text-[#1b7a3d] border border-[#1b7a3d] px-4 py-2 hover:bg-[#1b7a3d] hover:text-white transition-colors disabled:opacity-60">
            Release Hold
          </button>
        )}

        {canApprove && status === 'successful' && (
          <button type="button" onClick={() => setActiveForm(activeForm === 'reverse' ? null : 'reverse')} className="text-sm font-medium text-red-700 border border-red-700 px-4 py-2 hover:bg-red-700 hover:text-white transition-colors">
            Reverse
          </button>
        )}

        {['submitted', 'processing', 'unknown', 'manual_review'].includes(status) && (
          <button type="button" disabled={pending} onClick={handleCheckStatus} className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors disabled:opacity-60">
            {pending ? 'Checking Status…' : 'Check Status'}
          </button>
        )}
      </div>

      {activeForm === 'cancel' && (
        <ReasonForm pending={pending} reason={reason} setReason={setReason} label="Cancellation Reason (required)" buttonLabel="Confirm Cancellation" buttonClass="bg-[#8a1f1f] hover:bg-[#6e1919]" onSubmit={() => run(() => cancelPayout(payoutId, reason))} />
      )}
      {activeForm === 'hold' && (
        <ReasonForm pending={pending} reason={reason} setReason={setReason} label="Hold Reason (required)" buttonLabel="Confirm Hold" buttonClass="bg-[#8a5a00] hover:bg-[#6e4700]" onSubmit={() => run(() => placePayoutHold(payoutId, reason))} />
      )}
      {activeForm === 'reverse' && (
        <ReasonForm pending={pending} reason={reason} setReason={setReason} label="Reversal Reason (required)" buttonLabel="Confirm Reversal" buttonClass="bg-red-700 hover:bg-red-800" onSubmit={() => run(() => reversePayout(payoutId, reason))} />
      )}
    </div>
  );
}

function ReasonForm({
  pending,
  reason,
  setReason,
  label,
  buttonLabel,
  buttonClass,
  onSubmit,
}: {
  pending: boolean;
  reason: string;
  setReason: (v: string) => void;
  label: string;
  buttonLabel: string;
  buttonClass: string;
  onSubmit: () => void;
}) {
  return (
    <div className="flex items-end gap-2 flex-wrap">
      <div className="flex-1 min-w-[260px]">
        <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">{label}</label>
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="border border-[#bfc9c4] px-3 py-2 text-sm w-full focus:border-[#00342b] focus:outline-none" />
      </div>
      <button type="button" disabled={pending || !reason.trim()} onClick={onSubmit} className={`text-sm font-medium text-white px-4 py-2 transition-colors disabled:opacity-60 ${buttonClass}`}>
        {buttonLabel}
      </button>
    </div>
  );
}
