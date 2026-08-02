import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import ImportStatementForm from '@/components/admin/collections/ImportStatementForm';
import TransactionRowActions from '@/components/admin/collections/TransactionRowActions';
import ReviewAdjustmentButtons from '@/components/admin/collections/ReviewAdjustmentButtons';
import { formatMoney } from '@/lib/collections/money';
import {
  COLLECTION_RECONCILIATION_STATUSES,
  COLLECTION_RECONCILIATION_STATUS_COLORS,
  UNRESOLVED_RECONCILIATION_STATUSES,
  type CollectionTransaction,
  type CollectionManualAdjustment,
} from '@/data/collections';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

interface SearchParams {
  from?: string;
  to?: string;
  till?: string;
  merchant?: string;
  status?: string;
  view?: string;
}

export default async function CollectionLedgerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission('collections.view');
  } catch {
    return <AccessDenied requiredPermission="collections.view" />;
  }
  let canManage = true;
  try {
    await requirePermission('collections.manage');
  } catch {
    canManage = false;
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

  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: merchantRows }, { data: pendingAdjustments }] = await Promise.all([
    supabase.from('merchants').select('id, business_name').order('business_name'),
    canApprove
      ? supabase.from('collection_manual_adjustments').select('*').eq('status', 'pending_approval').order('requested_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const merchantNameById = new Map((merchantRows ?? []).map((m) => [m.id, m.business_name]));

  let query = supabase
    .from('collection_transactions')
    .select('*')
    .order('collected_at', { ascending: false })
    .limit(200);

  if (params.from) query = query.gte('collected_at', params.from);
  if (params.to) query = query.lte('collected_at', `${params.to}T23:59:59`);
  if (params.till) query = query.eq('till_reference', params.till);
  if (params.merchant) query = query.eq('merchant_id', params.merchant);
  if (params.view === 'unresolved') query = query.in('reconciliation_status', UNRESOLVED_RECONCILIATION_STATUSES);
  else if (params.status) query = query.eq('reconciliation_status', params.status);

  const { data, error } = await query;
  const transactions = (data ?? []) as CollectionTransaction[];
  const adjustments = (pendingAdjustments ?? []) as CollectionManualAdjustment[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Collection Ledger</h1>
        <p className="text-sm text-[#707975] mt-1">
          Manual import only — no live provider API is connected yet. All monetary totals are computed in the
          database, never in the browser.
        </p>
      </div>

      {canManage && <ImportStatementForm />}

      {canApprove && adjustments.length > 0 && (
        <div className="mb-6 bg-white border border-[#bfc9c4] p-6">
          <h2 className="font-semibold text-[#00342b] mb-4">Pending Manual Adjustments</h2>
          <ul className="divide-y divide-[#efeded]">
            {adjustments.map((a) => (
              <li key={a.id} className="py-3 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm text-[#1b1c1c]">{formatMoney(a.adjustment_amount)} — {a.reason}</p>
                  <p className="text-xs text-[#707975]">Requested by {a.requested_by} on {new Date(a.requested_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <ReviewAdjustmentButtons adjustmentId={a.id} transactionId={a.transaction_id} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <form className="mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">From</label>
          <input type="date" name="from" defaultValue={params.from} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">To</label>
          <input type="date" name="to" defaultValue={params.to} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Till</label>
          <input type="text" name="till" defaultValue={params.till} placeholder="Till reference" className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Status</label>
          <select name="status" defaultValue={params.status ?? ''} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none">
            <option value="">All</option>
            {COLLECTION_RECONCILIATION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <button type="submit" className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors">
          Filter
        </button>
        <a href="/admin/merchant-operations/collections?view=unresolved" className="text-sm font-medium text-[#8a1f1f] border border-[#8a1f1f] px-4 py-2 hover:bg-[#8a1f1f] hover:text-white transition-colors">
          Unresolved Queue
        </a>
      </form>

      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load transactions: {error.message}</p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Gross</th>
              <th className="px-4 py-3">Fee / Commission</th>
              <th className="px-4 py-3">Net</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Settlement</th>
              <th className="px-4 py-3">Collected</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3] align-top">
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{t.provider_transaction_reference}</td>
                <td className="px-4 py-3 text-[#3f4945]">{t.merchant_id ? merchantNameById.get(t.merchant_id) ?? '—' : '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{formatMoney(t.gross_amount, t.currency)}</td>
                <td className="px-4 py-3 text-[#3f4945] text-xs">{formatMoney(t.provider_fee, t.currency)} / {formatMoney(t.bizlink_commission, t.currency)}</td>
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{formatMoney(t.net_merchant_amount, t.currency)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${COLLECTION_RECONCILIATION_STATUS_COLORS[t.reconciliation_status] ?? ''}`}>
                    {labelFor(COLLECTION_RECONCILIATION_STATUSES, t.reconciliation_status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {t.settlement_eligibility ? <span className="text-[#1b7a3d] font-medium">Eligible</span> : <span className="text-[#707975]">Not eligible</span>}
                </td>
                <td className="px-4 py-3 text-[#3f4945] text-xs whitespace-nowrap">{new Date(t.collected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td className="px-4 py-3"><TransactionRowActions transactionId={t.id} canManage={canManage} canReconcile={canReconcile} /></td>
              </tr>
            ))}
            {transactions.length === 0 && !error && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-[#707975]">No transactions in this view.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
