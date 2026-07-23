'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { resolveSecurityEvent } from '@/app/admin/(protected)/compliance/security-events/actions';

export default function ResolveSecurityEventButton({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const runAction = async (target: 'investigating' | 'resolved' | 'false_positive') => {
    setPending(true);
    await resolveSecurityEvent(id, target);
    setPending(false);
    router.refresh();
  };

  if (status === 'resolved' || status === 'false_positive') {
    return <span className="text-xs text-[#707975]">—</span>;
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {status === 'open' && (
        <button
          type="button"
          disabled={pending}
          onClick={() => runAction('investigating')}
          className="text-xs font-medium px-3 py-1.5 border border-[#00342b] text-[#00342b] hover:bg-[#00342b] hover:text-white transition-colors disabled:opacity-60"
        >
          Investigate
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => runAction('resolved')}
        className="text-xs font-medium px-3 py-1.5 border border-[#1b7a3d] text-[#1b7a3d] hover:bg-[#1b7a3d] hover:text-white transition-colors disabled:opacity-60"
      >
        Resolve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => runAction('false_positive')}
        className="text-xs font-medium px-3 py-1.5 border border-[#707975] text-[#707975] hover:bg-[#707975] hover:text-white transition-colors disabled:opacity-60"
      >
        False Positive
      </button>
    </div>
  );
}
