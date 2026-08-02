'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DecisionForm({
  batchId,
  action,
  buttonLabel,
  buttonClassName,
  notesLabel,
  notesRequired,
  redirectTo,
}: {
  batchId: string;
  action: (batchId: string, notes: string) => Promise<{ success: boolean; message?: string }>;
  buttonLabel: string;
  buttonClassName: string;
  notesLabel: string;
  notesRequired: boolean;
  redirectTo: string;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await action(batchId, notes);
    setPending(false);
    if (!result.success) {
      setError(result.message ?? 'Action failed.');
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-6 space-y-4 max-w-2xl">
      <div>
        <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">{notesLabel}</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          required={notesRequired}
          rows={4}
          className="border border-[#bfc9c4] px-3 py-2 text-sm w-full focus:border-[#00342b] focus:outline-none"
        />
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">{error}</p>}
      <button type="submit" disabled={pending} className={buttonClassName}>
        {pending ? 'Submitting…' : buttonLabel}
      </button>
    </form>
  );
}
