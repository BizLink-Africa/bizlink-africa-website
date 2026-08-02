'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { refreshDisbursementBalance } from '@/app/admin/(protected)/settings/integrations/selcom/actions';
import { formatMoney } from '@/lib/collections/money';
import type {
  DisbursementBalanceSnapshot,
  DisbursementBalanceCheck,
  DisbursementBalanceReservation,
} from '@/lib/selcom/balance-service';

export interface SelcomDisbursementBalanceCardProps {
  snapshot: DisbursementBalanceSnapshot | null;
  pendingApprovedPayoutsTotal: number;
  reservedTotal: number;
  projectedBalance: number | null;
  lowBalance: boolean;
  insufficientBalance: boolean;
  history: DisbursementBalanceCheck[];
  reservations: DisbursementBalanceReservation[];
  environmentLabel: string;
  environmentValid: boolean;
  canRefresh: boolean;
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

// Super Admin / Finance disbursement balance dashboard — every figure
// here is server-computed (getDisbursementBalanceDashboard()); this
// component only formats and displays. The account number is never shown
// at all (Selcom doesn't return it as anything other than the same
// account already configured server-side — see status.ts's
// maskedDisbursementAccount for the one place it's ever surfaced, already
// masked there too).
export default function SelcomDisbursementBalanceCard({
  snapshot,
  pendingApprovedPayoutsTotal,
  reservedTotal,
  projectedBalance,
  lowBalance,
  insufficientBalance,
  history,
  reservations,
  environmentLabel,
  environmentValid,
  canRefresh,
}: SelcomDisbursementBalanceCardProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  async function handleRefresh() {
    setPending(true);
    setError(null);
    const result = await refreshDisbursementBalance();
    setPending(false);
    if (!result.success) {
      setError(result.message ?? 'Failed to refresh balance.');
      return;
    }
    router.refresh();
  }

  const currency = snapshot?.currency ?? 'TZS';

  return (
    <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-[#00342b]">Disbursement Balance</h2>
          <p className="text-xs text-[#707975] mt-0.5">Selcom Infinity Disbursement account (POST /v1/balance).</p>
        </div>
        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${environmentValid ? 'bg-purple-50 text-purple-700' : 'bg-red-50 text-red-700'}`}>
          {environmentLabel}
        </span>
      </div>

      <p className="text-xs text-[#8a5a00] bg-orange-50 border border-orange-200 px-3 py-2 mb-4">
        This figure is a cache of the last check, not live accounting truth — it can be stale, and must never replace
        formal bank/vendor-statement reconciliation.
      </p>

      {(lowBalance || insufficientBalance) && (
        <p className={`text-sm font-medium px-3 py-2 mb-4 border ${insufficientBalance ? 'text-red-700 bg-red-50 border-red-200' : 'text-[#8a5a00] bg-orange-50 border-orange-200'}`}>
          {insufficientBalance
            ? 'Insufficient balance: the projected balance after already-reserved payouts is negative.'
            : 'Low balance: the projected balance after already-reserved payouts is below the configured threshold.'}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-4 text-sm mb-4">
        <Field label="Available Balance" bold>
          {snapshot?.available_balance != null ? formatMoney(snapshot.available_balance, currency) : '—'}
        </Field>
        <Field label="Account Status">
          {snapshot?.account_active === null || snapshot?.account_active === undefined ? (
            '—'
          ) : (
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${snapshot.account_active ? 'bg-green-50 text-[#1b7a3d]' : 'bg-red-50 text-red-700'}`}>
              {snapshot.account_active ? 'Active' : 'Inactive'}
            </span>
          )}
        </Field>
        <Field label="Last Balance Check">
          {formatDateTime(snapshot?.checked_at ?? null)}
          {snapshot?.checked_by ? ` — ${snapshot.checked_by}` : ''}
        </Field>
        <Field label="Pending Approved Payouts">{formatMoney(pendingApprovedPayoutsTotal, currency)}</Field>
        <Field label="Reserved Payout Amount">{formatMoney(reservedTotal, currency)}</Field>
        <Field label="Projected Balance After Approved Payouts" bold>
          {projectedBalance !== null ? formatMoney(projectedBalance, currency) : '—'}
        </Field>
      </dl>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 mb-3">{error}</p>}

      {canRefresh && (
        <button
          type="button"
          disabled={pending}
          onClick={handleRefresh}
          className="text-sm font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#00241d] transition-colors disabled:opacity-60 mb-4"
        >
          {pending ? 'Refreshing…' : 'Refresh Balance'}
        </button>
      )}

      <button
        type="button"
        onClick={() => setHistoryOpen((v) => !v)}
        className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors"
      >
        {historyOpen ? 'Hide Balance Check History' : 'View Balance Check History'}
      </button>

      {historyOpen && (
        <div className="mt-3 bg-[#f5f3f3] border border-[#efeded] divide-y divide-[#e5e5e5] max-h-[360px] overflow-y-auto">
          {history.map((h) => (
            <div key={h.id} className="p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-medium text-[#1b1c1c]">
                  {h.trigger_type === 'manual' ? 'Manual refresh' : 'Batch approval check'}
                  {h.available_balance != null && ` — ${formatMoney(h.available_balance, h.currency ?? currency)}`}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${h.query_succeeded ? 'bg-green-50 text-[#1b7a3d]' : 'bg-red-50 text-red-700'}`}>
                  {h.query_succeeded ? 'succeeded' : 'failed'}
                </span>
              </div>
              <p className="text-xs text-[#707975] mt-0.5">
                {formatDateTime(h.checked_at)} · {h.checked_by}
              </p>
              {h.error_message && <p className="text-xs text-red-700 mt-1 italic">&quot;{h.error_message}&quot;</p>}
            </div>
          ))}
          {history.length === 0 && <p className="p-3 text-center text-sm text-[#707975]">No balance checks recorded yet.</p>}
        </div>
      )}

      {reservations.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-2">Recent Batch Reservations</h3>
          <div className="bg-[#f5f3f3] border border-[#efeded] divide-y divide-[#e5e5e5] max-h-[240px] overflow-y-auto">
            {reservations.map((r) => (
              <div key={r.id} className="p-3 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-[#1b1c1c] font-mono">{r.batch_id}</span>
                <span className="text-sm text-[#3f4945]">{formatMoney(r.reserved_amount, currency)}</span>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    r.status === 'active' ? 'bg-blue-50 text-blue-700' : r.status === 'consumed' ? 'bg-green-50 text-[#1b7a3d]' : 'bg-[#f5f3f3] text-[#707975]'
                  }`}
                >
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, bold }: { label: string; children: React.ReactNode; bold?: boolean }) {
  return (
    <div>
      <dt className="font-semibold text-[#707975] uppercase tracking-wider text-xs mb-1">{label}</dt>
      <dd className={bold ? 'font-semibold text-[#00342b]' : 'text-[#1b1c1c]'}>{children}</dd>
    </div>
  );
}
