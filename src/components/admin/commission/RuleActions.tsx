'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  submitCommissionFeeRule,
  approveCommissionFeeRule,
  rejectCommissionFeeRule,
  expireCommissionFeeRule,
} from '@/app/admin/(protected)/commission-rules/actions';
import type { CommissionRuleStatus } from '@/data/commission';

export default function RuleActions({
  ruleId,
  status,
  effectiveDate,
  canManage,
  canApprove,
}: {
  ruleId: string;
  status: CommissionRuleStatus;
  effectiveDate: string;
  canManage: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showExpire, setShowExpire] = useState(false);

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
        {canManage && status === 'draft' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => submitCommissionFeeRule(ruleId))}
            className="text-sm font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#004d40] transition-colors disabled:opacity-60"
          >
            Submit for Approval
          </button>
        )}

        {canApprove && status === 'pending_approval' && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => approveCommissionFeeRule(ruleId, notes))}
              className="text-sm font-medium text-white bg-[#1b7a3d] px-4 py-2 hover:bg-[#166030] transition-colors disabled:opacity-60"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setShowReject((v) => !v)}
              className="text-sm font-medium text-[#8a1f1f] border border-[#8a1f1f] px-4 py-2 hover:bg-[#8a1f1f] hover:text-white transition-colors disabled:opacity-60"
            >
              Reject
            </button>
          </>
        )}

        {canApprove && status === 'approved' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowExpire((v) => !v)}
            className="text-sm font-medium text-[#8a5a00] border border-[#8a5a00] px-4 py-2 hover:bg-[#8a5a00] hover:text-white transition-colors disabled:opacity-60"
          >
            Expire Rule
          </button>
        )}
      </div>

      {canApprove && status === 'pending_approval' && (
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Approval / Review Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="border border-[#bfc9c4] px-3 py-2 text-sm w-full max-w-md focus:border-[#00342b] focus:outline-none" placeholder="Required to reject; optional to approve" />
        </div>
      )}

      {showReject && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => rejectCommissionFeeRule(ruleId, notes))}
          className="text-sm font-medium text-white bg-[#8a1f1f] px-4 py-2 hover:bg-[#6e1919] transition-colors disabled:opacity-60"
        >
          Confirm Rejection
        </button>
      )}

      {showExpire && (
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Expiry Date</label>
            <input type="date" value={expiryDate} min={effectiveDate} onChange={(e) => setExpiryDate(e.target.value)} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Reason</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="border border-[#bfc9c4] px-3 py-2 text-sm w-full focus:border-[#00342b] focus:outline-none" />
          </div>
          <button
            type="button"
            disabled={pending || !expiryDate}
            onClick={() => run(() => expireCommissionFeeRule(ruleId, expiryDate, notes))}
            className="text-sm font-medium text-white bg-[#8a5a00] px-4 py-2 hover:bg-[#6e4700] transition-colors disabled:opacity-60"
          >
            Confirm Expiry
          </button>
        </div>
      )}
    </div>
  );
}
