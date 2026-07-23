'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { escalateTicket } from '@/app/admin/(protected)/support-tickets/actions';
import { ESCALATION_TARGETS, type EscalationTarget } from '@/data/tickets';

export default function EscalateTicketForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [target, setTarget] = useState<EscalationTarget>(ESCALATION_TARGETS[0].value);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await escalateTicket(ticketId, { target, reason });
    setSubmitting(false);
    if (result.success) {
      setReason('');
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to escalate.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select value={target} onChange={(e) => setTarget(e.target.value as EscalationTarget)} className={inputClass}>
          {ESCALATION_TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Escalation reason" required className={inputClass} />
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
      <button type="submit" disabled={submitting} className="border border-red-200 text-red-700 px-4 py-2 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-60">
        {submitting ? 'Escalating...' : 'Escalate Ticket'}
      </button>
    </form>
  );
}
