'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setProductionReadinessCheck } from '@/app/admin/(protected)/settings/integrations/selcom/production-readiness-actions';
import { PRODUCTION_READINESS_ITEMS, type ChecklistItemStatus, type ProductionReadinessCheckRow, type ProductionReadinessEvidence } from '@/lib/selcom/production-readiness-items';

const STATUS_LABELS: Record<ChecklistItemStatus, string> = {
  not_started: 'Not Started',
  passed: 'Passed',
  failed: 'Failed',
  not_applicable: 'Not Applicable',
};

const STATUS_COLORS: Record<ChecklistItemStatus, string> = {
  not_started: 'bg-[#f5f3f3] text-[#707975]',
  passed: 'bg-green-50 text-[#1b7a3d]',
  failed: 'bg-red-50 text-red-700',
  not_applicable: 'bg-blue-50 text-blue-700',
};

const EVIDENCE_LABELS: Partial<Record<keyof ProductionReadinessEvidence, string>> = {
  balance_api_passed: 'successful balance check(s) on record',
  bank_sandbox_payout_passed: 'successful bank payout(s) on record',
  mobile_wallet_sandbox_payout_passed: 'successful mobile-wallet payout(s) on record',
  status_checking_passed: 'successful status check(s) on record',
  callback_received_validated: 'processed callback(s) on record',
  duplicate_transaction_test_passed: 'duplicate callback(s) correctly detected',
};

// The 20-item production readiness checklist. Evidence hints (where
// available) are informational only — the pass/fail/not-applicable state
// is always a deliberate human attestation via
// set_selcom_production_readiness_check(), never auto-derived.
export default function ProductionReadinessChecklist({
  checks,
  evidence,
  canManage,
}: {
  checks: ProductionReadinessCheckRow[];
  evidence: ProductionReadinessEvidence;
  canManage: boolean;
}) {
  const router = useRouter();
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [pendingItem, setPendingItem] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const checksByKey = new Map(checks.map((c) => [c.item_key, c]));

  async function handleSave(itemKey: string, status: ChecklistItemStatus) {
    setPendingItem(itemKey);
    setError(null);
    const result = await setProductionReadinessCheck(itemKey, status, notesDraft);
    setPendingItem(null);
    if (!result.success) {
      setError(result.message ?? 'Failed to update checklist item.');
      return;
    }
    setOpenItem(null);
    setNotesDraft('');
    router.refresh();
  }

  const passedCount = checks.filter((c) => c.status === 'passed' || c.status === 'not_applicable').length;

  return (
    <div>
      <p className="text-sm text-[#3f4945] mb-3">
        {passedCount} of {PRODUCTION_READINESS_ITEMS.length} items passed or marked not applicable.
      </p>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 mb-3">{error}</p>}

      <div className="bg-white border border-[#bfc9c4] divide-y divide-[#efeded]">
        {PRODUCTION_READINESS_ITEMS.map((item) => {
          const check = checksByKey.get(item.key);
          const status = check?.status ?? 'not_started';
          const evidenceCount = (evidence as unknown as Record<string, number>)[item.key];
          const evidenceLabel = EVIDENCE_LABELS[item.key as keyof ProductionReadinessEvidence];

          return (
            <div key={item.key} className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-[#1b1c1c]">{item.label}</p>
                  <p className="text-xs text-[#707975] mt-0.5">{item.description}</p>
                  {evidenceLabel !== undefined && (
                    <p className="text-xs text-blue-700 mt-1">
                      Evidence: {evidenceCount ?? 0} {evidenceLabel}
                    </p>
                  )}
                  {check?.checked_by && (
                    <p className="text-xs text-[#707975] mt-1">
                      Last set by {check.checked_by}
                      {check.checked_at ? ` · ${new Date(check.checked_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
                    </p>
                  )}
                  {check?.notes && <p className="text-xs text-[#3f4945] mt-1 italic">&quot;{check.notes}&quot;</p>}
                </div>
                <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>
              </div>

              {canManage && (
                <div className="mt-3">
                  {openItem === item.key ? (
                    <div className="flex items-end gap-2 flex-wrap">
                      <div className="flex-1 min-w-[220px]">
                        <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Notes (optional)</label>
                        <input
                          type="text"
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          className="border border-[#bfc9c4] px-3 py-2 text-sm w-full focus:border-[#00342b] focus:outline-none"
                        />
                      </div>
                      {(['passed', 'failed', 'not_applicable', 'not_started'] as ChecklistItemStatus[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={pendingItem === item.key}
                          onClick={() => handleSave(item.key, s)}
                          className="text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-2 hover:bg-[#00342b] hover:text-white transition-colors disabled:opacity-60"
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenItem(item.key);
                        setNotesDraft(check?.notes ?? '');
                      }}
                      className="text-xs font-medium text-[#00342b] underline"
                    >
                      Update status
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
