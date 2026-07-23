'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { decideApprovalRequest } from '@/app/admin/(protected)/governance/approval-workflows/actions';

export default function ApprovalRequestActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<'approved' | 'rejected' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (status: 'approved' | 'rejected') => {
    setPending(status);
    setError(null);
    const result = await decideApprovalRequest(id, status);
    setPending(null);
    if (result.success) {
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to record decision.');
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => decide('approved')}
          disabled={pending !== null}
          className="text-xs font-medium text-[#1b7a3d] border border-[#1b7a3d] px-2.5 py-1.5 hover:bg-[#1b7a3d] hover:text-white transition-colors disabled:opacity-60"
        >
          {pending === 'approved' ? 'Saving...' : 'Approve'}
        </button>
        <button
          type="button"
          onClick={() => decide('rejected')}
          disabled={pending !== null}
          className="text-xs font-medium text-[#8a1f1f] border border-[#8a1f1f] px-2.5 py-1.5 hover:bg-[#8a1f1f] hover:text-white transition-colors disabled:opacity-60"
        >
          {pending === 'rejected' ? 'Saving...' : 'Reject'}
        </button>
      </div>
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}
