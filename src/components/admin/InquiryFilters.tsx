'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState } from 'react';

interface Option {
  value: string;
  label: string;
}

export default function InquiryFilters({
  statuses,
  solutions,
  notificationStatuses,
}: {
  statuses: readonly Option[];
  solutions: readonly Option[];
  notificationStatuses: readonly Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam('q', q);
  };

  const hasFilters = Array.from(searchParams.keys()).length > 0;

  return (
    <div className="bg-white border border-[#bfc9c4] p-4 flex flex-wrap gap-3 items-end">
      <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[220px]">
        <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Search</label>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, business, email, phone, or location"
          className="w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
        />
      </form>

      <div>
        <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Status</label>
        <select
          defaultValue={searchParams.get('status') ?? ''}
          onChange={(e) => updateParam('status', e.target.value)}
          className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
        >
          <option value="">All</option>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Solution</label>
        <select
          defaultValue={searchParams.get('solution') ?? ''}
          onChange={(e) => updateParam('solution', e.target.value)}
          className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
        >
          <option value="">All</option>
          {solutions.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Notification</label>
        <select
          defaultValue={searchParams.get('notification') ?? ''}
          onChange={(e) => updateParam('notification', e.target.value)}
          className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
        >
          <option value="">All</option>
          {notificationStatuses.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">From</label>
        <input
          type="date"
          defaultValue={searchParams.get('from') ?? ''}
          onChange={(e) => updateParam('from', e.target.value)}
          className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">To</label>
        <input
          type="date"
          defaultValue={searchParams.get('to') ?? ''}
          onChange={(e) => updateParam('to', e.target.value)}
          className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
        />
      </div>

      <button
        type="submit"
        onClick={handleSearchSubmit}
        className="bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        Apply
      </button>

      {hasFilters && (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="text-sm text-[#707975] hover:text-[#00342b] px-2 py-2"
        >
          Clear
        </button>
      )}
    </div>
  );
}
