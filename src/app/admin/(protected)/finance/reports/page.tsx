import { Download } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { getFinanceOverview } from '@/lib/dashboard/finance-adapters';
import { formatMoney } from '@/data/finance';

export const dynamic = 'force-dynamic';

const ADDITIONAL_REPORTS = [
  { type: 'revenue-by-service', label: 'Revenue by Service', description: 'Recognized revenue broken down by the 10 fee categories.' },
  { type: 'revenue-by-client', label: 'Revenue by Client', description: 'Recognized revenue per client, highest first.' },
  { type: 'expense-by-category', label: 'Expense by Category', description: 'Approved/paid expenses broken down by category.' },
  { type: 'receivables-aging', label: 'Receivables Aging', description: 'Outstanding invoices bucketed by days overdue.' },
  { type: 'proforma-conversion', label: 'Proforma Conversion', description: 'Every proforma with its status and, if converted, the resulting invoice.' },
  { type: 'invoice-payment-status', label: 'Invoice Payment Status', description: 'Every invoice with total, amount paid, and outstanding balance.' },
  { type: 'monthly-summary', label: 'Monthly Summary', description: 'Revenue, expenses, and net profit for the last 12 months.' },
  { type: 'annual-summary', label: 'Annual Summary', description: 'Revenue, expenses, and net profit for the last 5 years.' },
] as const;

export default async function FinancialReportsPage() {
  try {
    await requirePermission('finance.reports.view');
  } catch {
    return <AccessDenied requiredPermission="finance.reports.view" />;
  }

  const supabase = await createClient();
  const overview = await getFinanceOverview(supabase);

  if (!overview) {
    return (
      <div>
        <h1 className="font-bold text-2xl text-[#00342b] mb-2">Financial Reports</h1>
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load financial data.</p>
      </div>
    );
  }

  const { currency } = overview;
  const m = (n: number) => formatMoney(n, currency);

  const plRows = [
    { label: 'Total Revenue', value: overview.totalRevenue },
    { label: '  Subscription Income', value: overview.subscriptionIncome, indent: true },
    { label: '  Setup Fee Income', value: overview.setupFeeIncome, indent: true },
    { label: '  Implementation Fee Income', value: overview.implementationFeeIncome, indent: true },
    { label: 'Total Expenses', value: -overview.totalExpenses },
    { label: 'Net Profit', value: overview.netProfit, bold: true },
  ];

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Financial Reports</h1>
          <p className="text-sm text-[#707975] mt-1">Profit &amp; loss summary, based on recognized (issued+) invoices and approved/paid expenses.</p>
        </div>
        <a
          href="/admin/finance/reports/export"
          className="inline-flex items-center gap-2 border border-[#00342b] text-[#00342b] px-4 py-2 text-sm font-medium hover:bg-[#00342b] hover:text-white transition-colors"
        >
          <Download size={14} /> Export CSV
        </a>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
        <h2 className="font-semibold text-[#00342b] mb-4">Profit &amp; Loss</h2>
        <table className="w-full text-sm">
          <tbody>
            {plRows.map((row) => (
              <tr key={row.label} className={row.bold ? 'border-t border-[#bfc9c4]' : ''}>
                <td className={`py-2 ${row.indent ? 'pl-4 text-xs text-[#707975]' : row.bold ? 'font-semibold text-[#00342b]' : 'text-[#3f4945]'}`}>
                  {row.label}
                </td>
                <td className={`py-2 text-right tabular-nums ${row.bold ? 'font-semibold text-[#00342b]' : row.value < 0 ? 'text-[#8a1f1f]' : 'text-[#1b1c1c]'}`}>
                  {m(row.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
        <h2 className="font-semibold text-[#00342b] mb-4">Cash Flow (This Month)</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr><td className="py-2 text-[#3f4945]">Cash In (payments received)</td><td className="py-2 text-right text-[#1b7a3d] tabular-nums">{m(overview.cashInThisMonth)}</td></tr>
            <tr><td className="py-2 text-[#3f4945]">Cash Out (expenses paid)</td><td className="py-2 text-right text-[#8a1f1f] tabular-nums">-{m(overview.cashOutThisMonth)}</td></tr>
            <tr className="border-t border-[#bfc9c4]">
              <td className="py-2 font-semibold text-[#00342b]">Net Cash Flow</td>
              <td className="py-2 text-right font-semibold text-[#00342b] tabular-nums">{m(overview.cashInThisMonth - overview.cashOutThisMonth)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-4">Receivables &amp; Proforma Pipeline</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr><td className="py-2 text-[#3f4945]">Outstanding Receivables</td><td className="py-2 text-right tabular-nums">{m(overview.outstandingReceivables)}</td></tr>
            <tr><td className="py-2 text-[#3f4945]">Paid Invoices</td><td className="py-2 text-right tabular-nums">{overview.paidInvoicesCount}</td></tr>
            <tr><td className="py-2 text-[#3f4945]">Unpaid Invoices</td><td className="py-2 text-right tabular-nums">{overview.unpaidInvoicesCount}</td></tr>
            <tr><td className="py-2 text-[#3f4945]">Overdue Invoices</td><td className="py-2 text-right tabular-nums">{overview.overdueInvoicesCount}</td></tr>
            <tr><td className="py-2 text-[#3f4945]">Pending Proforma Invoices</td><td className="py-2 text-right tabular-nums">{overview.pendingProformasCount}</td></tr>
            <tr>
              <td className="py-2 text-[#3f4945]">Proforma Conversion Rate</td>
              <td className="py-2 text-right tabular-nums">
                {overview.totalProformasCount > 0 ? `${Math.round((overview.convertedProformasCount / overview.totalProformasCount) * 100)}%` : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="font-semibold text-[#00342b] mb-4">Additional Reports</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ADDITIONAL_REPORTS.map((report) => (
            <div key={report.type} className="bg-white border border-[#bfc9c4] p-5 flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-[#1b1c1c]">{report.label}</h3>
                <p className="text-sm text-[#707975] mt-1">{report.description}</p>
              </div>
              <a
                href={`/admin/finance/reports/export?type=${report.type}`}
                className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors w-fit"
              >
                <Download size={14} /> Export CSV
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
