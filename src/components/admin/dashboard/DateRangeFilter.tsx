'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { DATE_RANGE_OPTIONS, type DateRangeKey } from '@/lib/dashboard/types';

export default function DateRangeFilter({ current }: { current: DateRangeKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', value);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <select
      value={current}
      onChange={(e) => handleChange(e.target.value)}
      className="border border-[#bfc9c4] bg-white px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
    >
      {DATE_RANGE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
