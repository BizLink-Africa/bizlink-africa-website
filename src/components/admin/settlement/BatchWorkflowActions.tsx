'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  submitSettlementBatchForReview,
  processSettlementBatch,
  placeSettlementBatchHold,
  releaseSettlementBatchHold,
  emergencyCancelSettlementBatch,
} from '@/app/admin/(protected)/settlement/actions';
import type { SettlementBatchStatus } from '@/data/settlement';

export default function BatchWorkflowActions({
  batchId,
  status,
  complianceHold,
  hasVariance,
  canPrepare,
  canReview,
  canApprove,
  canComplianceHold,
  canProcess,
  canEmergency,
}: {
  batchId: string;
  status: SettlementBatchStatus;
  complianceHold: boolean;
  hasVariance: boolean;
  canPrepare: boolean;
  canReview: boolean;
  canApprove: boolean;
  canComplianceHold: boolean;
  canProcess: boolean;
  canEmergency: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [varianceNotes, setVarianceNotes] = useState('');
  const [showVarianceForm, setShowVarianceForm] = useState(false);
  const [showHoldForm, setShowHoldForm] = useState(false);
  const [showEmergencyForm, setShowEmergencyForm] = useState(false);
  const [reason, setReason] = useState('');

  async function run(action: () => Promise<{ success: boolean; message?: string }>) {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (!result.success) {
      setError(result.message ?? 'Action failed.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {canPrepare && status === 'reconciliation_pending' && !showVarianceForm && (
          <button
            type="button"
            disabled={pending}
            onClick={() => (hasVariance ? setShowVarianceForm(true) : run(() => submitSettlementBatchForReview(batchId, null)))}
            className="text-sm font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#004d40] transition-colors disabled:opacity-60"
          >
            Submit for Review
          </button>
        )}

        {canReview && status === 'ready_for_review' && (
          <Link href={`/admin/settlement/${batchId}/review`} className="text-sm font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#004d40] transition-colors">
            Go to Review Screen
          </Link>
        )}

        {canApprove && status === 'ready_for_approval' && (
          <Link href={`/admin/settlement/${batchId}/approve`} className="text-sm font-medium text-white bg-[#1b7a3d] px-4 py-2 hover:bg-[#166030] transition-colors">
            Go to Approval Screen
          </Link>
        )}

        {(canReview || canApprove) && (status === 'ready_for_review' || status === 'ready_for_approval') && (
          <Link href={`/admin/settlement/${batchId}/reject`} className="text-sm font-medium text-[#8a1f1f] border border-[#8a1f1f] px-4 py-2 hover:bg-[#8a1f1f] hover:text-white transition-colors">
            Go to Rejection Screen
          </Link>
        )}

        {canProcess && status === 'approved' && !complianceHold && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => processSettlementBatch(batchId))}
            className="text-sm font-medium text-white bg-[#6b21a8] px-4 py-2 hover:bg-[#581c87] transition-colors disabled:opacity-60"
          >
            {pending ? 'Processing…' : 'Begin Payout Processing (Sandbox)'}
          </button>
        )}

        {canComplianceHold && !complianceHold && !['completed', 'cancelled', 'failed'].includes(status) && (
          <button type="button" onClick={() => setShowHoldForm((v) => !v)} className="text-sm font-medium text-[#8a5a00] border border-[#8a5a00] px-4 py-2 hover:bg-[#8a5a00] hover:text-white transition-colors">
            Place Compliance Hold
          </button>
        )}
        {canComplianceHold && complianceHold && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => releaseSettlementBatchHold(batchId, ''))}
            className="text-sm font-medium text-[#1b7a3d] border border-[#1b7a3d] px-4 py-2 hover:bg-[#1b7a3d] hover:text-white transition-colors disabled:opacity-60"
          >
            Release Compliance Hold
          </button>
        )}

        {canEmergency && !['completed', 'cancelled'].includes(status) && (
          <button type="button" onClick={() => setShowEmergencyForm((v) => !v)} className="text-sm font-medium text-red-700 border border-red-700 px-4 py-2 hover:bg-red-700 hover:text-white transition-colors">
            Emergency Cancel
          </button>
        )}
      </div>

      {showVarianceForm && (
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">
              Variance is not zero — authorised resolution notes
            </label>
            <input type="text" value={varianceNotes} onChange={(e) => setVarianceNotes(e.target.value)} className="border border-[#bfc9c4] px-3 py-2 text-sm w-full focus:border-[#00342b] focus:outline-none" />
          </div>
          <button
            type="button"
            disabled={pending || !varianceNotes.trim()}
            onClick={() => run(() => submitSettlementBatchForReview(batchId, varianceNotes))}
            className="text-sm font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#004d40] transition-colors disabled:opacity-60"
          >
            Submit with Resolution
          </button>
        </div>
      )}

      {showHoldForm && (
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Hold Reason</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="border border-[#bfc9c4] px-3 py-2 text-sm w-full focus:border-[#00342b] focus:outline-none" />
          </div>
          <button
            type="button"
            disabled={pending || !reason.trim()}
            onClick={() => run(() => placeSettlementBatchHold(batchId, reason))}
            className="text-sm font-medium text-white bg-[#8a5a00] px-4 py-2 hover:bg-[#6e4700] transition-colors disabled:opacity-60"
          >
            Confirm Hold
          </button>
        </div>
      )}

      {showEmergencyForm && (
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs font-semibold text-red-800 uppercase tracking-wider mb-1">Emergency Cancellation Reason (required)</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="border border-red-300 px-3 py-2 text-sm w-full focus:border-red-700 focus:outline-none" />
          </div>
          <button
            type="button"
            disabled={pending || !reason.trim()}
            onClick={() => run(() => emergencyCancelSettlementBatch(batchId, reason))}
            className="text-sm font-medium text-white bg-red-700 px-4 py-2 hover:bg-red-800 transition-colors disabled:opacity-60"
          >
            Confirm Emergency Cancel
          </button>
        </div>
      )}
    </div>
  );
}
