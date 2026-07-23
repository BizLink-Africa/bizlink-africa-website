'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { retryBackgroundJob } from '@/app/admin/(protected)/background-jobs/actions';

export default function RetryJobButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      const result = await retryBackgroundJob(id);
      if (!result.success) {
        setError(result.message ?? 'Failed to retry.');
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="text-xs font-medium text-[#00342b] border border-[#00342b] px-2 py-1 hover:bg-[#00342b] hover:text-white transition-colors disabled:opacity-50"
      >
        {pending ? 'Retrying...' : 'Retry'}
      </button>
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}
