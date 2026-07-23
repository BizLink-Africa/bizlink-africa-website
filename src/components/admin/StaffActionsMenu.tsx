'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical } from 'lucide-react';
import { setStaffActive, setStaffMfa } from '@/app/admin/(protected)/staff/actions';

export default function StaffActionsMenu({
  id,
  isActive,
  mfaEnabled,
}: {
  id: string;
  isActive: boolean;
  mfaEnabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const run = async (action: () => Promise<{ success: boolean; message?: string }>) => {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (!result.success) {
      setError(result.message ?? 'Action failed.');
      return;
    }
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="p-1.5 border border-[#bfc9c4] text-[#3f4945] hover:bg-[#f5f3f3] transition-colors disabled:opacity-60"
        aria-label="Staff actions"
      >
        <MoreVertical size={14} />
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-1 w-48 bg-white border border-[#bfc9c4] shadow-lg text-left">
          <button
            type="button"
            onClick={() => run(() => setStaffActive(id, !isActive))}
            className={`w-full text-left px-3 py-2 text-xs hover:bg-[#f5f3f3] transition-colors ${isActive ? 'text-red-700' : 'text-[#00342b]'}`}
          >
            {isActive ? 'Deactivate account' : 'Activate account'}
          </button>
          <button
            type="button"
            onClick={() => run(() => setStaffMfa(id, !mfaEnabled))}
            className="w-full text-left px-3 py-2 text-xs text-[#3f4945] hover:bg-[#f5f3f3] transition-colors border-t border-[#e5e5e5]"
          >
            {mfaEnabled ? 'Mark MFA disabled' : 'Mark MFA enabled'}
          </button>
        </div>
      )}
      {error && <p className="absolute right-0 mt-1 w-48 text-xs text-red-700 bg-white border border-red-200 px-2 py-1.5 z-10">{error}</p>}
    </div>
  );
}
