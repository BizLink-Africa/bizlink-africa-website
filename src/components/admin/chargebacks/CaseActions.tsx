'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  requestChargebackEvidence,
  submitChargebackEvidence,
  beginChargebackReview,
  resolveChargebackCase,
  closeChargebackCase,
  recordChargebackRecovery,
} from '@/app/admin/(protected)/chargebacks/actions';
import { CHARGEBACK_RECOVERY_METHODS } from '@/data/chargebacks';
import type { ChargebackCaseStatus } from '@/data/chargebacks';

export default function CaseActions({
  caseId,
  caseStatus,
  recoveryStatus,
  canManage,
  canResolve,
}: {
  caseId: string;
  caseStatus: ChargebackCaseStatus;
  recoveryStatus: string;
  canManage: boolean;
  canResolve: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [evidenceDueAt, setEvidenceDueAt] = useState('');
  const [recoveryAmount, setRecoveryAmount] = useState('');
  const [recoveryMethod, setRecoveryMethod] = useState<string>(CHARGEBACK_RECOVERY_METHODS[0].value);
  const [activeForm, setActiveForm] = useState<'evidence' | 'resolve_won' | 'resolve_lost' | 'resolve_withdrawn' | 'close' | 'recovery' | null>(null);

  async function run(action: () => Promise<{ success: boolean; message?: string }>) {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (!result.success) {
      setError(result.message ?? 'Action failed.');
      return;
    }
    setActiveForm(null);
    setNotes('');
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {canManage && caseStatus === 'open' && (
          <button type="button" onClick={() => setActiveForm(activeForm === 'evidence' ? null : 'evidence')} className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors">
            Request Evidence
          </button>
        )}
        {canManage && caseStatus === 'evidence_requested' && (
          <button type="button" disabled={pending} onClick={() => run(() => submitChargebackEvidence(caseId))} className="text-sm font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#004d40] transition-colors disabled:opacity-60">
            Mark Evidence Submitted
          </button>
        )}
        {canResolve && ['open', 'evidence_submitted'].includes(caseStatus) && (
          <button type="button" disabled={pending} onClick={() => run(() => beginChargebackReview(caseId))} className="text-sm font-medium text-white bg-[#6b21a8] px-4 py-2 hover:bg-[#581c87] transition-colors disabled:opacity-60">
            Move to Under Review
          </button>
        )}
        {canResolve && caseStatus === 'under_review' && (
          <>
            <button type="button" onClick={() => setActiveForm('resolve_won')} className="text-sm font-medium text-white bg-[#1b7a3d] px-4 py-2 hover:bg-[#166030] transition-colors">Resolve — Won</button>
            <button type="button" onClick={() => setActiveForm('resolve_lost')} className="text-sm font-medium text-white bg-[#8a1f1f] px-4 py-2 hover:bg-[#6e1919] transition-colors">Resolve — Lost</button>
            <button type="button" onClick={() => setActiveForm('resolve_withdrawn')} className="text-sm font-medium text-white bg-[#8a5a00] px-4 py-2 hover:bg-[#6e4700] transition-colors">Resolve — Withdrawn</button>
          </>
        )}
        {canManage && recoveryStatus === 'pending' || recoveryStatus === 'partially_recovered' ? (
          <button type="button" onClick={() => setActiveForm(activeForm === 'recovery' ? null : 'recovery')} className="text-sm font-medium text-[#8a5a00] border border-[#8a5a00] px-4 py-2 hover:bg-[#8a5a00] hover:text-white transition-colors">
            Record Recovery
          </button>
        ) : null}
        {canResolve && ['won', 'lost', 'withdrawn'].includes(caseStatus) && (
          <button type="button" onClick={() => setActiveForm(activeForm === 'close' ? null : 'close')} className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors">
            Close Case
          </button>
        )}
      </div>

      {activeForm === 'evidence' && (
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Evidence Due Date</label>
            <input type="datetime-local" value={evidenceDueAt} onChange={(e) => setEvidenceDueAt(e.target.value)} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none" />
          </div>
          <button type="button" disabled={pending} onClick={() => run(() => requestChargebackEvidence(caseId, evidenceDueAt || null))} className="text-sm font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#004d40] transition-colors disabled:opacity-60">
            Confirm Request
          </button>
        </div>
      )}

      {(activeForm === 'resolve_won' || activeForm === 'resolve_lost' || activeForm === 'resolve_withdrawn') && (
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Resolution Notes (required)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="border border-[#bfc9c4] px-3 py-2 text-sm w-full focus:border-[#00342b] focus:outline-none" />
          </div>
          <button
            type="button"
            disabled={pending || !notes.trim()}
            onClick={() => run(() => resolveChargebackCase(caseId, activeForm.replace('resolve_', '') as 'won' | 'lost' | 'withdrawn', notes))}
            className="text-sm font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#004d40] transition-colors disabled:opacity-60"
          >
            Confirm Resolution
          </button>
        </div>
      )}

      {activeForm === 'close' && (
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Closing Notes (optional)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="border border-[#bfc9c4] px-3 py-2 text-sm w-full focus:border-[#00342b] focus:outline-none" />
          </div>
          <button type="button" disabled={pending} onClick={() => run(() => closeChargebackCase(caseId, notes))} className="text-sm font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#004d40] transition-colors disabled:opacity-60">
            Confirm Close
          </button>
        </div>
      )}

      {activeForm === 'recovery' && (
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Amount</label>
            <input type="text" value={recoveryAmount} onChange={(e) => setRecoveryAmount(e.target.value)} className="border border-[#bfc9c4] px-3 py-2 text-sm w-28 focus:border-[#00342b] focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Method</label>
            <select value={recoveryMethod} onChange={(e) => setRecoveryMethod(e.target.value)} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none">
              {CHARGEBACK_RECOVERY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="border border-[#bfc9c4] px-3 py-2 text-sm w-full focus:border-[#00342b] focus:outline-none" />
          </div>
          <button
            type="button"
            disabled={pending || !recoveryAmount}
            onClick={() => run(() => recordChargebackRecovery(caseId, recoveryAmount, recoveryMethod, notes))}
            className="text-sm font-medium text-white bg-[#8a5a00] px-4 py-2 hover:bg-[#6e4700] transition-colors disabled:opacity-60"
          >
            Record Recovery
          </button>
        </div>
      )}
    </div>
  );
}
