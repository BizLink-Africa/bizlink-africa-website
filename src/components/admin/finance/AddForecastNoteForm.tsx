'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addForecastNote } from '@/app/admin/(protected)/finance/forecasting/actions';

export default function AddForecastNoteForm({ defaultPeriod }: { defaultPeriod: string }) {
  const router = useRouter();
  const [period, setPeriod] = useState(defaultPeriod);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await addForecastNote(period, notes);
    setSubmitting(false);
    if (result.success) {
      setNotes('');
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to save note.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
        <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Period, e.g. 2026-08" className={inputClass} />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Scenario notes — assumptions, risks, upcoming deals..." required className={`${inputClass} resize-none`} />
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
      <button type="submit" disabled={submitting} className="bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {submitting ? 'Saving...' : 'Add Scenario Note'}
      </button>
    </form>
  );
}
