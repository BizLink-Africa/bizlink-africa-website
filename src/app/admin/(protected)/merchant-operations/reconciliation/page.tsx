import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import ReconciliationRunForm from '@/components/admin/collections/ReconciliationRunForm';
import ApproveReconciliationButton from '@/components/admin/collections/ApproveReconciliationButton';
import { formatMoney } from '@/lib/collections/money';
import { RECONCILIATION_RUN_STATUSES, RECONCILIATION_RUN_STATUS_COLORS, type CollectionReconciliationRun } from '@/data/collections';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

export default async function DailyReconciliationPage() {
  try {
    await requirePermission('collections.view');
  } catch {
    return <AccessDenied requiredPermission="collections.view" />;
  }
  let canReconcile = true;
  try {
    await requirePermission('collections.reconcile');
  } catch {
    canReconcile = false;
  }
  let canApprove = true;
  try {
    await requirePermission('collections.approve');
  } catch {
    canApprove = false;
  }

  const supabase = await createClient();
  const [{ data: merchantRows }, { data: runRows }, { count: unresolvedCount }] = await Promise.all([
    supabase.from('merchants').select('id, business_name').order('business_name'),
    supabase.from('collection_reconciliation_runs').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('collection_transactions').select('id', { count: 'exact', head: true }).in('reconciliation_status', ['unmatched', 'partially_matched', 'under_review', 'duplicate']),
  ]);

  const runs = (runRows ?? []) as CollectionReconciliationRun[];
  const merchantNameById = new Map((merchantRows ?? []).map((m) => [m.id, m.business_name]));

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Daily Reconciliation</h1>
        <p className="text-sm text-[#707975] mt-1">
          Reconciliation totals and variance are computed entirely in the database (exact numeric arithmetic) —
          never recalculated in the browser. Approved runs are immutable.
        </p>
      </div>

      {canReconcile && <ReconciliationRunForm merchants={merchantRows ?? []} />}

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-4">Reconciliation History</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-[#707975]">No reconciliation runs yet.</p>
        ) : (
          <ul className="divide-y divide-[#efeded]">
            {runs.map((r) => {
              const varianceAmount = Number(r.variance);
              const hasVariance = Number.isFinite(varianceAmount) && Math.abs(varianceAmount) > 0.001;
              return (
                <li key={r.id} className="py-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
                    <div>
                      <span className="text-sm font-medium text-[#1b1c1c]">
                        {new Date(r.from_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {new Date(r.to_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {r.till_reference && <span className="text-xs text-[#707975] ml-2">Till: {r.till_reference}</span>}
                      {r.merchant_id && <span className="text-xs text-[#707975] ml-2">{merchantNameById.get(r.merchant_id) ?? '—'}</span>}
                    </div>
                    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${RECONCILIATION_RUN_STATUS_COLORS[r.status] ?? ''}`}>
                      {labelFor(RECONCILIATION_RUN_STATUSES, r.status)}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-2">
                    <div><dt className="text-[#707975]">Gross</dt><dd className="text-[#1b1c1c] font-medium">{formatMoney(r.total_gross)}</dd></div>
                    <div><dt className="text-[#707975]">Provider Fees</dt><dd className="text-[#1b1c1c] font-medium">{formatMoney(r.total_provider_fees)}</dd></div>
                    <div><dt className="text-[#707975]">BizLink Commission</dt><dd className="text-[#1b1c1c] font-medium">{formatMoney(r.total_bizlink_commission)}</dd></div>
                    <div><dt className="text-[#707975]">Net Merchant</dt><dd className="text-[#1b1c1c] font-medium">{formatMoney(r.total_net_merchant)}</dd></div>
                    <div><dt className="text-[#707975]">Reversals</dt><dd className="text-[#1b1c1c] font-medium">{formatMoney(r.total_reversals)}</dd></div>
                    <div><dt className="text-[#707975]">Chargebacks</dt><dd className="text-[#1b1c1c] font-medium">{formatMoney(r.total_chargebacks)}</dd></div>
                    <div><dt className="text-[#707975]">Matched / Unresolved</dt><dd className="text-[#1b1c1c] font-medium">{r.matched_count} / {r.unresolved_count}</dd></div>
                    <div>
                      <dt className="text-[#707975]">Variance</dt>
                      <dd className={`font-medium ${hasVariance ? 'text-[#8a1f1f]' : 'text-[#1b7a3d]'}`}>{r.vendor_amount_received ? formatMoney(r.variance) : '—'}</dd>
                    </div>
                  </dl>
                  {r.status === 'approved' ? (
                    <p className="text-xs text-[#707975]">Approved by {r.approved_by} on {r.approved_at ? new Date(r.approved_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}{r.approval_notes ? ` — ${r.approval_notes}` : ''}</p>
                  ) : (
                    canApprove && <ApproveReconciliationButton runId={r.id} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-[#707975] mt-4">
        {unresolvedCount ?? 0} unresolved item{(unresolvedCount ?? 0) === 1 ? '' : 's'} across all transactions — see
        the Collection Ledger&apos;s Unresolved Queue.
      </p>
    </div>
  );
}
