'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { recordCsat } from '@/app/admin/(protected)/support/satisfaction/actions';
import type { StaffOption } from '@/components/admin/crm/StaffPicker';

interface TicketOption {
  id: string;
  ticket_number: string | null;
  title: string;
  client_id: string | null;
}

export default function RecordCsatForm({ tickets, staff }: { tickets: TicketOption[]; staff: StaffOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ticketId, setTicketId] = useState('');
  const [agentUserId, setAgentUserId] = useState('');
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const ticket = tickets.find((t) => t.id === ticketId);
    const result = await recordCsat({ ticketId, clientId: ticket?.client_id ?? undefined, agentUserId: agentUserId || undefined, rating, feedback: feedback || undefined });
    setSubmitting(false);
    if (result.success) {
      setTicketId('');
      setAgentUserId('');
      setRating(5);
      setFeedback('');
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to save.');
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors">
        <Plus size={14} /> Record Rating
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">Record Customer Satisfaction</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]"><X size={18} /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="ticketId">Ticket</label>
          <select id="ticketId" value={ticketId} onChange={(e) => setTicketId(e.target.value)} required className={inputClass}>
            <option value="">Select ticket...</option>
            {tickets.map((t) => <option key={t.id} value={t.id}>{t.ticket_number ?? t.title}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="agentUserId">Agent</label>
          <select id="agentUserId" value={agentUserId} onChange={(e) => setAgentUserId(e.target.value)} className={inputClass}>
            <option value="">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="rating">Rating (1-5)</label>
          <input id="rating" type="number" min={1} max={5} value={rating} onChange={(e) => setRating(Number(e.target.value) || 1)} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="feedback">Feedback</label>
          <textarea id="feedback" rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} className={`${inputClass} resize-none`} />
        </div>
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
      <button type="submit" disabled={submitting} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {submitting ? 'Saving...' : 'Save Rating'}
      </button>
    </form>
  );
}
