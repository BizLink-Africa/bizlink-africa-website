'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { acknowledgePolicy } from '@/app/admin/(protected)/compliance/policy-acknowledgements/actions';

export default function AcknowledgePolicyButton({ policyId }: { policyId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      const result = await acknowledgePolicy(policyId);
      if (!result.success) {
        setError(result.message ?? 'Failed to acknowledge.');
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
        className="text-xs font-medium text-white bg-[#00342b] px-3 py-1.5 hover:bg-[#004d40] transition-colors disabled:opacity-50"
      >
        {pending ? 'Acknowledging...' : 'Acknowledge'}
      </button>
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}
