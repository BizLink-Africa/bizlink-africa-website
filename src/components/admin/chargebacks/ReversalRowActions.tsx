'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { approveManualReversal, rejectManualReversal } from '@/app/admin/(protected)/chargebacks/actions';

export default function ReversalRowActions({ requestId, canApprove }: { requestId: string; canApprove: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [notes, setNotes] = useState('');

  async function run(action: () => Promise<{ success: boolean; message?: string }>) {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (!result.success) {
      setError(result.message ?? 'Action failed.');
      return;
    }
    setShowReject(false);
    router.refresh();
  }

  if (!canApprove) return null;

  return (
    <div className="flex flex-col gap-1 items-end">
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={() => run(() => approveManualReversal(requestId, ''))} className="text-xs font-medium text-white bg-[#1b7a3d] px-2.5 py-1 hover:bg-[#166030] transition-colors disabled:opacity-60">
          Approve
        </button>
        <button type="button" disabled={pending} onClick={() => setShowReject((v) => !v)} className="text-xs font-medium text-[#8a1f1f] border border-[#8a1f1f] px-2.5 py-1 hover:bg-[#8a1f1f] hover:text-white transition-colors disabled:opacity-60">
          Reject
        </button>
      </div>
      {showReject && (
        <div className="flex items-center gap-2 mt-1">
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason" className="border border-[#bfc9c4] px-2 py-1 text-xs w-40 focus:border-[#00342b] focus:outline-none" />
          <button type="button" disabled={pending || !notes.trim()} onClick={() => run(() => rejectManualReversal(requestId, notes))} className="text-xs font-medium text-white bg-[#8a1f1f] px-2.5 py-1 hover:bg-[#6e1919] transition-colors disabled:opacity-60">
            Confirm
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
