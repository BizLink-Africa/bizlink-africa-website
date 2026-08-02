'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPayoutsForBatch } from '@/app/admin/(protected)/payouts/actions';

export default function CreatePayoutsButton({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await createPayoutsForBatch(batchId);
    setPending(false);
    if (!result.success) {
      setError(result.message ?? 'Failed to create payout requests.');
      return;
    }
    setMessage(
      result.createdCount && result.createdCount > 0
        ? `${result.createdCount} payout request(s) created.`
        : 'No new payout requests — every eligible line already has one.'
    );
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className="text-sm font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {pending ? 'Requesting…' : 'Create Payout Requests'}
      </button>
      <a href={`/admin/payouts?batch=${batchId}`} className="text-sm font-medium text-[#00342b] hover:underline">
        View Payouts for This Batch →
      </a>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {message && <p className="text-sm text-[#1b7a3d]">{message}</p>}
    </div>
  );
}
