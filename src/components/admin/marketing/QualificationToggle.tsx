'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setLeadQualification } from '@/app/admin/(protected)/marketing/leads/actions';

export default function QualificationToggle({ leadId, field, value, label }: { leadId: string; field: 'is_mql' | 'is_sql'; value: boolean; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleToggle = async () => {
    setPending(true);
    const result = await setLeadQualification(leadId, field, !value);
    setPending(false);
    if (result.success) router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending}
      className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors disabled:opacity-60 ${
        value ? 'bg-[#dcf5e3] text-[#1b7a3d] border-[#bfe5cc]' : 'bg-[#eeeeee] text-[#707975] border-[#bfc9c4] hover:bg-[#e5e5e5]'
      }`}
    >
      {label}
    </button>
  );
}
