'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestSettlementHoldRelease, approveSettlementHoldRelease, rejectSettlementHoldRelease } from '@/app/admin/(protected)/chargebacks/actions';
import type { SettlementHoldStatus } from '@/data/holds';

export default function HoldReleaseActions({
  holdId,
  status,
  releaseRequestedBy,
  canManage,
  canApprove,
}: {
  holdId: string;
  status: SettlementHoldStatus;
  releaseRequestedBy: string | null;
  canManage: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showDecisionForm, setShowDecisionForm] = useState<'approve' | 'reject' | null>(null);

  async function run(action: () => Promise<{ success: boolean; message?: string }>) {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (!result.success) {
      setError(result.message ?? 'Action failed.');
      return;
    }
    setNotes('');
    setShowRequestForm(false);
    setShowDecisionForm(null);
    router.refresh();
  }

  if (status === 'released') {
    return <p className="text-sm text-[#707975]">This hold has been released.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">{error}</p>}

      {!releaseRequestedBy && canManage && (
        <button type="button" onClick={() => setShowRequestForm((v) => !v)} className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors">
          Request Release
        </button>
      )}
      {showRequestForm && (
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Release Reason (required)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="border border-[#bfc9c4] px-3 py-2 text-sm w-full focus:border-[#00342b] focus:outline-none" />
          </div>
          <button type="button" disabled={pending || !notes.trim()} onClick={() => run(() => requestSettlementHoldRelease(holdId, notes))} className="text-sm font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#004d40] transition-colors disabled:opacity-60">
            Submit Request
          </button>
        </div>
      )}

      {releaseRequestedBy && canApprove && (
        <div className="space-y-2">
          <p className="text-sm text-[#707975]">Release requested by {releaseRequestedBy} — a different Compliance user must approve or reject.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowDecisionForm('approve')} className="text-sm font-medium text-white bg-[#1b7a3d] px-4 py-2 hover:bg-[#166030] transition-colors">Approve Release</button>
            <button type="button" onClick={() => setShowDecisionForm('reject')} className="text-sm font-medium text-[#8a1f1f] border border-[#8a1f1f] px-4 py-2 hover:bg-[#8a1f1f] hover:text-white transition-colors">Reject</button>
          </div>
          {showDecisionForm && (
            <div className="flex items-end gap-2 flex-wrap">
              <div className="flex-1 min-w-[260px]">
                <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Notes</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="border border-[#bfc9c4] px-3 py-2 text-sm w-full focus:border-[#00342b] focus:outline-none" />
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => (showDecisionForm === 'approve' ? approveSettlementHoldRelease(holdId, notes) : rejectSettlementHoldRelease(holdId, notes)))}
                className={`text-sm font-medium text-white px-4 py-2 transition-colors disabled:opacity-60 ${showDecisionForm === 'approve' ? 'bg-[#1b7a3d] hover:bg-[#166030]' : 'bg-[#8a1f1f] hover:bg-[#6e1919]'}`}
              >
                Confirm {showDecisionForm === 'approve' ? 'Approval' : 'Rejection'}
              </button>
            </div>
          )}
        </div>
      )}
      {releaseRequestedBy && !canApprove && (
        <p className="text-sm text-[#707975]">Release requested by {releaseRequestedBy} — awaiting approval.</p>
      )}
    </div>
  );
}
