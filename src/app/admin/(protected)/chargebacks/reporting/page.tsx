import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { formatMoney } from '@/lib/collections/money';
import { CHARGEBACK_CASE_STATUSES, CHARGEBACK_REASONS } from '@/data/chargebacks';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

interface StatusCount { case_status: string; case_count: number; total_disputed: string }
interface ReasonCount { reason: string; case_count: number; total_disputed: string }
interface RecoveryTotals {
  won_count: number; lost_count: number; withdrawn_count: number;
  total_lost_amount: string; total_recovered_amount: string; total_unrecovered_amount: string;
}

export default async function ChargebackReportingPage() {
  try {
    await requirePermission('chargebacks.view');
  } catch {
    return <AccessDenied requiredPermission="chargebacks.view" />;
  }

  const supabase = await createClient();
  const [{ data: statusRows }, { data: reasonRows }, { data: recoveryRows }] = await Promise.all([
    supabase.from('chargeback_status_counts').select('*'),
    supabase.from('chargeback_reason_counts').select('*'),
    supabase.from('chargeback_recovery_totals').select('*').maybeSingle(),
  ]);
  const statuses = (statusRows ?? []) as StatusCount[];
  const reasons = (reasonRows ?? []) as ReasonCount[];
  const recovery = recoveryRows as RecoveryTotals | null;

  const resolvedCount = (recovery?.won_count ?? 0) + (recovery?.lost_count ?? 0) + (recovery?.withdrawn_count ?? 0);
  const winRate = resolvedCount > 0 ? Math.round(((recovery?.won_count ?? 0) / resolvedCount) * 100) : null;

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/chargebacks" className="text-xs font-medium text-[#00342b] hover:underline">← Chargeback Cases</Link>
        <h1 className="font-bold text-2xl text-[#00342b] mt-3">Chargeback Reporting</h1>
        <p className="text-sm text-[#707975] mt-1">All counts and totals are computed in the database.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard label="Won" value={String(recovery?.won_count ?? 0)} />
        <SummaryCard label="Lost" value={String(recovery?.lost_count ?? 0)} />
        <SummaryCard label="Withdrawn" value={String(recovery?.withdrawn_count ?? 0)} />
        <SummaryCard label="Win Rate" value={winRate !== null ? `${winRate}%` : '—'} />
        <SummaryCard label="Total Lost" value={formatMoney(recovery?.total_lost_amount ?? '0', 'TZS')} />
        <SummaryCard label="Total Recovered" value={formatMoney(recovery?.total_recovered_amount ?? '0', 'TZS')} />
        <SummaryCard label="Total Unrecovered" value={formatMoney(recovery?.total_unrecovered_amount ?? '0', 'TZS')} highlight />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="font-semibold text-[#00342b] mb-3">By Status</h2>
          <div className="bg-white border border-[#bfc9c4] divide-y divide-[#efeded]">
            {statuses.map((s) => (
              <div key={s.case_status} className="p-3 flex items-center justify-between text-sm">
                <span className="text-[#1b1c1c]">{labelFor(CHARGEBACK_CASE_STATUSES, s.case_status)}</span>
                <span className="text-[#3f4945]">{s.case_count} · {formatMoney(s.total_disputed, 'TZS')}</span>
              </div>
            ))}
            {statuses.length === 0 && <p className="p-3 text-center text-sm text-[#707975]">No cases yet.</p>}
          </div>
        </div>
        <div>
          <h2 className="font-semibold text-[#00342b] mb-3">By Reason</h2>
          <div className="bg-white border border-[#bfc9c4] divide-y divide-[#efeded]">
            {reasons.map((r) => (
              <div key={r.reason} className="p-3 flex items-center justify-between text-sm">
                <span className="text-[#1b1c1c]">{labelFor(CHARGEBACK_REASONS, r.reason)}</span>
                <span className="text-[#3f4945]">{r.case_count} · {formatMoney(r.total_disputed, 'TZS')}</span>
              </div>
            ))}
            {reasons.length === 0 && <p className="p-3 text-center text-sm text-[#707975]">No cases yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-white border border-[#bfc9c4] p-4">
      <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-[#8a1f1f]' : 'text-[#00342b]'}`}>{value}</p>
    </div>
  );
}
