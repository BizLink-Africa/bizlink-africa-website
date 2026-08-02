'use client';

import { useState } from 'react';
import { addMerchantNote } from '@/app/admin/(protected)/merchant-operations/actions';
import type { MerchantNote } from '@/data/merchantOperations';

export default function MerchantNotesPanel({
  merchantId,
  notes,
  canManage,
}: {
  merchantId: string;
  notes: MerchantNote[];
  canManage: boolean;
}) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await addMerchantNote(merchantId, note);
    setSubmitting(false);
    if (!result.success) {
      setError(result.message ?? 'Failed to add note.');
      return;
    }
    setNote('');
  };

  return (
    <div>
      {canManage && (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-5">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Add an internal note…"
            className="flex-1 border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none resize-none"
          />
          <button
            type="submit"
            disabled={submitting || !note.trim()}
            className="bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60 whitespace-nowrap self-start"
          >
            {submitting ? 'Adding…' : 'Add Note'}
          </button>
        </form>
      )}
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 mb-4">{error}</p>}

      {notes.length === 0 ? (
        <p className="text-sm text-[#707975]">No internal notes yet.</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {notes.map((n) => (
            <li key={n.id} className="border-b border-[#efeded] last:border-0 pb-3 last:pb-0">
              <p className="text-[#1b1c1c] whitespace-pre-wrap">{n.note}</p>
              <p className="text-xs text-[#707975] mt-1">{n.created_by} · {new Date(n.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
