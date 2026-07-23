'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { approveExpense, ceoApproveExpense, rejectExpense } from '@/app/admin/(protected)/finance/expenses/actions';

// Two-stage expense approval: CFO's "Approve" routes server-side to either
// approved or pending_ceo_approval depending on the configurable high-value
// threshold (see approveExpense) — this component never decides that
// itself, it just calls the right action for the stage a given expense is
// actually in. `stage` distinguishes which permission/action applies.
export default function ExpenseApprovalQueueButtons({ id, stage }: { id: string; stage: 'cfo' | 'ceo' }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runApprove = async () => {
    if (!window.confirm('Approve this expense?')) return;
    setPending(true);
    setError(null);
    const result = stage === 'cfo' ? await approveExpense(id) : await ceoApproveExpense(id);
    setPending(false);
    if (!result.success) setError(result.message ?? 'Failed to approve.');
    else router.refresh();
  };

  const runReject = async () => {
    if (!window.confirm('Reject this expense?')) return;
    setPending(true);
    setError(null);
    const result = await rejectExpense(id);
    setPending(false);
    if (!result.success) setError(result.message ?? 'Failed to reject.');
    else router.refresh();
  };

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={runApprove}
          className="text-xs font-medium px-3 py-1.5 border border-[#00342b] text-[#00342b] hover:bg-[#00342b] hover:text-white transition-colors disabled:opacity-60"
        >
          {stage === 'cfo' ? 'Approve' : 'CEO Approve'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={runReject}
          className="text-xs font-medium px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-60"
        >
          Reject
        </button>
      </div>
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}
