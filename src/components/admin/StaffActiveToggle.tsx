'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setStaffActive } from '@/app/admin/(protected)/staff/actions';

export default function StaffActiveToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setPending(true);
    await setStaffActive(id, !isActive);
    setPending(false);
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={`text-xs font-medium px-2.5 py-1.5 border transition-colors disabled:opacity-60 whitespace-nowrap ${
        isActive ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-[#00342b] text-[#00342b] hover:bg-[#00342b] hover:text-white'
      }`}
    >
      {pending ? 'Saving...' : isActive ? 'Deactivate' : 'Activate'}
    </button>
  );
}
