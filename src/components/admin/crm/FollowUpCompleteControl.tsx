'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { completeFollowUp } from '@/app/admin/(protected)/crm/follow-ups/actions';

export default function FollowUpCompleteControl({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [pending, setPending] = useState(false);

  if (status !== 'scheduled') {
    return <span className="text-xs text-[#707975]">—</span>;
  }

  if (!open) {
    return (
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium px-3 py-1.5 border border-[#00342b] text-[#00342b] hover:bg-[#00342b] hover:text-white transition-colors">
          Complete
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm('Cancel this follow-up?')) return;
            setPending(true);
            await completeFollowUp(id, 'cancelled');
            setPending(false);
            router.refresh();
          }}
          disabled={pending}
          className="text-xs font-medium px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 min-w-[200px]">
      <input value={result} onChange={(e) => setResult(e.target.value)} placeholder="Result" className="w-full border border-[#bfc9c4] px-2 py-1 text-xs focus:border-[#00342b] focus:outline-none" />
      <input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Next action (optional)" className="w-full border border-[#bfc9c4] px-2 py-1 text-xs focus:border-[#00342b] focus:outline-none" />
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            await completeFollowUp(id, 'completed', result, nextAction);
            setPending(false);
            router.refresh();
          }}
          className="text-xs font-medium bg-[#00342b] text-white px-3 py-1.5 hover:bg-[#004d40] disabled:opacity-60"
        >
          {pending ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-medium text-[#707975] px-3 py-1.5">
          Cancel
        </button>
      </div>
    </div>
  );
}
