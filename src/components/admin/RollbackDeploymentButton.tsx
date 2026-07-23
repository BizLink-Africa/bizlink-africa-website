'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { rollbackDeployment } from '@/app/admin/(protected)/deployments/actions';

export default function RollbackDeploymentButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    if (!window.confirm('Roll back this deployment? This marks it rolled back and starts the rollback workflow.')) return;
    setError(null);
    startTransition(async () => {
      const result = await rollbackDeployment(id);
      if (!result.success) {
        setError(result.message ?? 'Failed to roll back.');
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
        disabled={disabled || pending}
        className="text-xs font-medium text-[#8a1f1f] border border-[#8a1f1f] px-2 py-1 hover:bg-[#8a1f1f] hover:text-white transition-colors disabled:opacity-50"
      >
        {pending ? 'Rolling back...' : 'Roll Back'}
      </button>
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}
