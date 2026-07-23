import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import AddForecastNoteForm from '@/components/admin/finance/AddForecastNoteForm';
import { formatMoney, type ForecastNote } from '@/data/finance';

export const dynamic = 'force-dynamic';

const RECOGNIZED_REVENUE_STATUSES = ['issued', 'partially_paid', 'paid', 'overdue'];
const RECOGNIZED_EXPENSE_STATUSES = ['approved', 'paid'];

function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export default async function FinancialForecastingPage() {
  let canManage = true;
  try {
    await requirePermission('forecasting.view');
  } catch {
    return <AccessDenied requiredPermission="forecasting.view" />;
  }
  try {
    await requirePermission('forecasting.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const today = new Date();
  const trailingStart = new Date(today.getFullYear(), today.getMonth() - 3, 1).toISOString().slice(0, 10);

  const [{ data: invoices }, { data: expenses }, { data: settings }, { data: notes }] = await Promise.all([
    supabase.from('invoices').select('status, total, outstanding_balance, issue_date').in('status', RECOGNIZED_REVENUE_STATUSES).gte('issue_date', trailingStart),
    supabase.from('expenses').select('status, amount, expense_date').in('status', RECOGNIZED_EXPENSE_STATUSES).gte('expense_date', trailingStart),
    supabase.from('company_settings').select('default_currency').eq('id', true).single(),
    supabase.from('financial_forecast_notes').select('*').order('created_at', { ascending: false }).limit(20),
  ]);

  const currency = settings?.default_currency ?? 'TZS';

  // Trailing 3-month average — a flat baseline, deliberately simple (no
  // seasonality/regression) so the projection is easy to sanity-check
  // against the raw numbers it came from.
  const revenueTotal = (invoices ?? []).reduce((s, i) => s + i.total, 0);
  const expenseTotal = (expenses ?? []).reduce((s, e) => s + e.amount, 0);
  const monthlyRevenueAvg = revenueTotal / 3;
  const monthlyExpenseAvg = expenseTotal / 3;

  const { data: outstandingInvoices } = await supabase
    .from('invoices')
    .select('outstanding_balance')
    .in('status', ['issued', 'partially_paid', 'overdue'])
    .gt('outstanding_balance', 0);
  const currentOutstanding = (outstandingInvoices ?? []).reduce((s, i) => s + i.outstanding_balance, 0);

  const projectedMonths = [1, 2, 3].map((offset) => {
    const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    return {
      label: monthLabel(d),
      revenueForecast: monthlyRevenueAvg,
      expenseForecast: monthlyExpenseAvg,
      cashFlowForecast: monthlyRevenueAvg - monthlyExpenseAvg,
      receivablesForecast: currentOutstanding,
    };
  });

  const noteRows = (notes ?? []) as ForecastNote[];
  const defaultPeriod = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().slice(0, 7);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Financial Forecasting</h1>
        <p className="text-sm text-[#707975] mt-1">
          Trailing 3-month average projected forward — a simple baseline, not a statistical model. Add scenario notes
          below for known upcoming deals, risks, or seasonal adjustments this baseline can&apos;t see.
        </p>
      </div>

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Month</th>
              <th className="px-4 py-3">Revenue Forecast</th>
              <th className="px-4 py-3">Expense Forecast</th>
              <th className="px-4 py-3">Cash-Flow Forecast</th>
              <th className="px-4 py-3">Receivables Forecast</th>
            </tr>
          </thead>
          <tbody>
            {projectedMonths.map((m) => (
              <tr key={m.label} className="border-b border-[#e5e5e5] last:border-0">
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">{m.label}</td>
                <td className="px-4 py-3 tabular-nums text-[#1b7a3d]">{formatMoney(m.revenueForecast, currency)}</td>
                <td className="px-4 py-3 tabular-nums text-[#8a1f1f]">{formatMoney(m.expenseForecast, currency)}</td>
                <td className={`px-4 py-3 tabular-nums font-medium ${m.cashFlowForecast >= 0 ? 'text-[#1b7a3d]' : 'text-[#8a1f1f]'}`}>{formatMoney(m.cashFlowForecast, currency)}</td>
                <td className="px-4 py-3 tabular-nums text-[#3f4945]">{formatMoney(m.receivablesForecast, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-4">Scenario Notes</h2>
        {canManage && (
          <div className="mb-4 pb-4 border-b border-[#e5e5e5]">
            <AddForecastNoteForm defaultPeriod={defaultPeriod} />
          </div>
        )}
        {noteRows.length === 0 ? (
          <p className="text-sm text-[#707975]">No scenario notes yet.</p>
        ) : (
          <ul className="space-y-3">
            {noteRows.map((n) => (
              <li key={n.id} className="border-b border-[#e5e5e5] last:border-0 pb-3 last:pb-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-[#00342b] uppercase tracking-wider">{n.period}</span>
                  <span className="text-xs text-[#707975]">{n.created_by} · {new Date(n.created_at).toLocaleDateString('en-GB')}</span>
                </div>
                <p className="text-sm text-[#3f4945] mt-1">{n.scenario_notes}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
