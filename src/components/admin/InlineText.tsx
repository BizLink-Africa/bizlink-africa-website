'use client';

import { useState, useTransition } from 'react';

export default function InlineText({
  value,
  onSave,
  placeholder,
  className,
}: {
  value: string;
  onSave: (value: string) => Promise<{ success: boolean; message?: string }>;
  placeholder?: string;
  className?: string;
}) {
  const [current, setCurrent] = useState(value);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const commit = () => {
    if (current === value) return;
    const previous = value;
    setPending(true);
    setError(null);

    startTransition(async () => {
      const result = await onSave(current);
      setPending(false);
      if (!result.success) {
        setCurrent(previous);
        setError(result.message ?? 'Failed to save.');
      }
    });
  };

  return (
    <div>
      <input
        value={current}
        placeholder={placeholder}
        onChange={(e) => setCurrent(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        disabled={pending}
        className={className ?? 'w-full border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none'}
      />
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}
