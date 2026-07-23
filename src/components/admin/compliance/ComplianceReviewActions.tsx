'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { COMPLIANCE_STATUSES, RISK_LEVELS } from '@/data/compliance';
import { updateComplianceReview } from '@/app/admin/(protected)/compliance/reviews/actions';

export default function ComplianceReviewActions({
  id,
  status,
  riskLevel,
}: {
  id: string;
  status: string;
  riskLevel: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState(status);
  const [nextRisk, setNextRisk] = useState(riskLevel ?? '');
  const [findings, setFindings] = useState('');
  const [correctiveActions, setCorrectiveActions] = useState('');
  const [correctiveActionDueDate, setCorrectiveActionDueDate] = useState('');
  const [evidence, setEvidence] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors"
      >
        Update
      </button>
    );
  }

  const handleSave = async () => {
    setPending(true);
    setError(null);
    const result = await updateComplianceReview(id, {
      status: nextStatus as (typeof COMPLIANCE_STATUSES)[number]['value'],
      findings,
      riskLevel: (nextRisk || undefined) as (typeof RISK_LEVELS)[number]['value'] | undefined,
      correctiveActions,
      correctiveActionDueDate,
      evidence,
    });
    setPending(false);
    if (result.success) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to update.');
    }
  };

  const inputClass = 'w-full border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none';

  return (
    <div className="space-y-2 min-w-[240px]">
      <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} className={inputClass}>
        {COMPLIANCE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <select value={nextRisk} onChange={(e) => setNextRisk(e.target.value)} className={inputClass}>
        <option value="">No risk level</option>
        {RISK_LEVELS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <textarea value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="Findings" rows={2} className={inputClass} />
      <textarea value={correctiveActions} onChange={(e) => setCorrectiveActions(e.target.value)} placeholder="Corrective actions" rows={2} className={inputClass} />
      <input type="date" value={correctiveActionDueDate} onChange={(e) => setCorrectiveActionDueDate(e.target.value)} className={inputClass} title="Corrective action due date" />
      <textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Evidence" rows={2} className={inputClass} />
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="text-xs font-medium bg-[#00342b] text-white px-3 py-1.5 hover:bg-[#004d40] transition-colors disabled:opacity-60"
        >
          {pending ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-medium text-[#707975] px-3 py-1.5 hover:text-[#00342b]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
