'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { revokeSession } from '@/app/admin/(protected)/security/sessions/actions';

export default function RevokeSessionButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    if (!window.confirm('Revoke this session?')) return;
    setError(null);
    startTransition(async () => {
      const result = await revokeSession(id);
      if (!result.success) {
        setError(result.message ?? 'Failed to revoke.');
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
        className="text-xs font-medium text-[#8a1f1f] border border-[#8a1f1f] px-2 py-1 hover:bg-[#8a1f1f] hover:text-white transition-colors disabled:opacity-50"
      >
        {pending ? 'Revoking...' : 'Revoke'}
      </button>
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}
