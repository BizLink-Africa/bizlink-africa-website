'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { upsertEvidenceItem } from '@/app/admin/(protected)/chargebacks/actions';
import { CHARGEBACK_EVIDENCE_TYPES, CHARGEBACK_EVIDENCE_ITEM_STATUSES, type ChargebackEvidenceItem } from '@/data/chargebacks';

export default function EvidenceChecklist({
  caseId,
  items,
  canManage,
}: {
  caseId: string;
  items: ChargebackEvidenceItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const itemByType = new Map(items.map((i) => [i.evidence_type, i]));

  async function handleChange(evidenceType: string, status: string) {
    setPending(evidenceType);
    setError(null);
    const result = await upsertEvidenceItem(caseId, evidenceType, status, itemByType.get(evidenceType)?.notes ?? '');
    setPending(null);
    if (!result.success) {
      setError(result.message ?? 'Failed to update evidence item.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="bg-white border border-[#bfc9c4] p-6">
      <h2 className="font-semibold text-[#00342b] mb-4">Evidence Checklist</h2>
      {error && <p className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">{error}</p>}
      <div className="divide-y divide-[#efeded]">
        {CHARGEBACK_EVIDENCE_TYPES.map((type) => {
          const item = itemByType.get(type.value);
          return (
            <div key={type.value} className="py-3 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm text-[#1b1c1c]">{type.label}</p>
                {item?.submitted_at && <p className="text-xs text-[#707975]">Submitted {new Date(item.submitted_at).toLocaleDateString('en-GB')} by {item.submitted_by}</p>}
              </div>
              {canManage ? (
                <select
                  value={item?.status ?? 'requested'}
                  disabled={pending === type.value}
                  onChange={(e) => handleChange(type.value, e.target.value)}
                  className="border border-[#bfc9c4] px-2.5 py-1.5 text-xs focus:border-[#00342b] focus:outline-none"
                >
                  {CHARGEBACK_EVIDENCE_ITEM_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              ) : (
                <span className="text-xs text-[#707975]">{item?.status ?? 'Not requested'}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
