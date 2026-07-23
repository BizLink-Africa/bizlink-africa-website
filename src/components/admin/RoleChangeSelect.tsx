'use client';

import { useState, useTransition } from 'react';

interface Option {
  value: string;
  label: string;
}

// Same InlineSelect-driven save flow as every other inline editor in this
// app, but role changes get an explicit confirm step first — role is the
// one field on this page that can grant or remove real system access, so a
// misclick shouldn't silently take effect the way department/notes edits do.
export default function RoleChangeSelect({
  value,
  options,
  onSave,
  className,
}: {
  value: string;
  options: readonly Option[];
  onSave: (value: string) => Promise<{ success: boolean; message?: string }>;
  className?: string;
}) {
  const [current, setCurrent] = useState(value);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const pendingLabel = confirming ? options.find((o) => o.value === confirming)?.label ?? confirming : '';

  const commit = (next: string) => {
    const previous = current;
    setCurrent(next);
    setConfirming(null);
    setPending(true);
    setError(null);

    startTransition(async () => {
      const result = await onSave(next);
      setPending(false);
      if (!result.success) {
        setCurrent(previous);
        setError(result.message ?? 'Failed to save.');
      }
    });
  };

  if (confirming) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-[#1b1c1c]">
          Change role to <span className="font-semibold">{pendingLabel}</span>?
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => commit(confirming)}
            className="text-xs font-medium px-2 py-1 bg-[#00342b] text-white hover:bg-[#004d40] transition-colors"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setConfirming(null)}
            className="text-xs font-medium px-2 py-1 border border-[#bfc9c4] text-[#3f4945] hover:bg-[#f5f3f3] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <select
        value={current}
        onChange={(e) => {
          if (e.target.value === current) return;
          setConfirming(e.target.value);
        }}
        disabled={pending}
        className={className ?? 'border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none'}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {pending && <p className="text-xs text-[#707975] mt-1">Saving...</p>}
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}
