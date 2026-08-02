'use client';

import { useState, useTransition } from 'react';
import { assignMerchantStaff } from '@/app/admin/(protected)/merchant-operations/actions';

export default function MerchantStaffAssignment({
  merchantId,
  currentStaffId,
  staff,
  canManage,
}: {
  merchantId: string;
  currentStaffId: string | null;
  staff: { id: string; full_name: string }[];
  canManage: boolean;
}) {
  const [value, setValue] = useState(currentStaffId ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleChange = (next: string) => {
    const previous = value;
    setValue(next);
    setPending(true);
    setError(null);

    startTransition(async () => {
      const result = await assignMerchantStaff(merchantId, next || null);
      setPending(false);
      if (!result.success) {
        setValue(previous);
        setError(result.message ?? 'Failed to assign staff.');
      }
    });
  };

  if (!canManage) {
    const current = staff.find((s) => s.id === currentStaffId);
    return <p className="text-sm text-[#1b1c1c]">{current?.full_name ?? 'Unassigned'}</p>;
  }

  return (
    <div>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={pending}
        className="w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
      >
        <option value="">Unassigned</option>
        {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
      </select>
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}
