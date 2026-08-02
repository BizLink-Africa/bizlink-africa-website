'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { approveReconciliationRun } from '@/app/admin/(protected)/merchant-operations/reconciliation/actions';

export default function ApproveReconciliationButton({ runId }: { runId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    const notes = window.prompt('Approval notes (optional):') ?? '';
    setPending(true);
    setError(null);
    const result = await approveReconciliationRun(runId, notes);
    setPending(false);
    if (!result.success) {
      setError(result.message ?? 'Failed to approve.');
      return;
    }
    router.refresh();
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleApprove}
        disabled={pending}
        className="text-xs font-medium text-white bg-[#00342b] px-3 py-1.5 hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {pending ? 'Approving…' : 'Approve Run'}
      </button>
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}
