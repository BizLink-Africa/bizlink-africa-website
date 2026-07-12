'use client';

import { useState, useTransition } from 'react';

interface Option {
  value: string;
  label: string;
}

export default function InlineSelect({
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
  const [, startTransition] = useTransition();

  const handleChange = (next: string) => {
    const previous = current;
    setCurrent(next);
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

  return (
    <div>
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        disabled={pending}
        className={className ?? 'border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none'}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}
