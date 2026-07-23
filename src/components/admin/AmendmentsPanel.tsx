'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { logContractAmendment } from '@/app/admin/(protected)/contracts/actions';

interface Amendment {
  id: string;
  description: string;
  effective_date: string | null;
  requested_by: string | null;
  created_at: string;
}

export default function AmendmentsPanel({ contractId, amendments, canManage }: { contractId: string; amendments: Amendment[]; canManage: boolean }) {
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await logContractAmendment(contractId, { description, effectiveDate: effectiveDate || undefined });
    setSaving(false);
    if (result.success) {
      setDescription('');
      setEffectiveDate('');
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to log amendment.');
    }
  };

  return (
    <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
      <h2 className="font-semibold text-[#00342b] mb-3">Amendments</h2>
      {amendments.length === 0 ? (
        <p className="text-sm text-[#707975] mb-3">No amendments logged.</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {amendments.map((a) => (
            <li key={a.id} className="text-sm border-b border-[#e5e5e5] last:border-0 pb-2 last:pb-0">
              <p className="text-[#1b1c1c]">{a.description}</p>
              <p className="text-xs text-[#707975] mt-0.5">
                {a.requested_by ?? 'unknown'} {a.effective_date && `· effective ${a.effective_date}`} · {new Date(a.created_at).toLocaleDateString('en-GB')}
              </p>
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <div className="space-y-2 pt-2 border-t border-[#e5e5e5]">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Describe the amendment..."
            className={`${inputClass} resize-none`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none" />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Log Amendment'}
            </button>
          </div>
          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
