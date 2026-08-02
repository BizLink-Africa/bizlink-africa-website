'use client';

import { useState } from 'react';
import { updateMerchantStatus } from '@/app/admin/(protected)/merchant-operations/actions';
import { MERCHANT_ONBOARDING_STATUSES, MERCHANT_ONBOARDING_STATUS_COLORS, type MerchantOnboardingStatus, type MerchantStatusHistoryEntry } from '@/data/merchantOperations';
import { labelFor } from '@/data/inquiries';

export default function MerchantStatusPanel({
  merchantId,
  currentStatus,
  canManage,
  history,
}: {
  merchantId: string;
  currentStatus: MerchantOnboardingStatus;
  canManage: boolean;
  history: MerchantStatusHistoryEntry[];
}) {
  const [status, setStatus] = useState<MerchantOnboardingStatus>(currentStatus);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await updateMerchantStatus(merchantId, status, note);
    setSubmitting(false);
    if (!result.success) {
      setError(result.message ?? 'Failed to update status.');
      return;
    }
    setNote('');
  };

  return (
    <div>
      {canManage && (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-5">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as MerchantOnboardingStatus)}
            className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
          >
            {MERCHANT_ONBOARDING_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note about this change…"
            className="flex-1 border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting || status === currentStatus}
            className="bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            {submitting ? 'Saving…' : 'Update Status'}
          </button>
        </form>
      )}
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 mb-4">{error}</p>}

      <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-2">Status History</p>
      {history.length === 0 ? (
        <p className="text-sm text-[#707975]">No status changes recorded yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex items-start justify-between gap-3 border-b border-[#efeded] last:border-0 pb-2 last:pb-0">
              <div>
                <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full mr-2 ${MERCHANT_ONBOARDING_STATUS_COLORS[h.to_status] ?? ''}`}>
                  {labelFor(MERCHANT_ONBOARDING_STATUSES, h.to_status)}
                </span>
                {h.note && <span className="text-[#3f4945]">{h.note}</span>}
                <div className="text-xs text-[#707975] mt-0.5">by {h.changed_by}</div>
              </div>
              <span className="text-xs text-[#707975] whitespace-nowrap">{new Date(h.changed_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
