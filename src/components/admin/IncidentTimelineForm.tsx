'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { INCIDENT_STATUSES } from '@/data/technicalIncidents';
import { updateIncidentStatus, addIncidentUpdate } from '@/app/admin/(protected)/technical-incidents/actions';

export default function IncidentTimelineForm({ id, currentStatus }: { id: string; currentStatus: string }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [status, setStatus] = useState(currentStatus);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = status !== currentStatus
      ? await updateIncidentStatus(id, status, note)
      : await addIncidentUpdate(id, note);
    setSubmitting(false);

    if (result.success) {
      setNote('');
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to add update.');
    }
  };

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-3">
      <h3 className="font-semibold text-[#00342b] text-sm">Add Timeline Update</h3>
      <div>
        <label className={labelClass} htmlFor="status">Status</label>
        <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
          {INCIDENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor="note">Note</label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="What's happening / what changed"
          required
          className={inputClass}
        />
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-5 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Saving...' : 'Add Update'}
      </button>
    </form>
  );
}
