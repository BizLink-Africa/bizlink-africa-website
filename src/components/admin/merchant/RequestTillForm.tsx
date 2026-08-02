'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { requestMerchantTill } from '@/app/admin/(protected)/merchant-operations/tills/actions';

export default function RequestTillForm({ merchants }: { merchants: { id: string; business_name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [merchantId, setMerchantId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantId) {
      setError('Select a merchant.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await requestMerchantTill(merchantId, notes);
    setSubmitting(false);
    if (!result.success) {
      setError(result.message ?? 'Failed to request till.');
      return;
    }
    setOpen(false);
    setNotes('');
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> Request Till
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">Request Till</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>
      <div>
        <label className={labelClass} htmlFor="merchantId">Merchant</label>
        <select id="merchantId" value={merchantId} onChange={(e) => setMerchantId(e.target.value)} required className={inputClass}>
          <option value="">Select a merchant</option>
          {merchants.map((m) => <option key={m.id} value={m.id}>{m.business_name}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor="notes">Notes</label>
        <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputClass} resize-none`} />
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Requesting…' : 'Request Till'}
      </button>
    </form>
  );
}
