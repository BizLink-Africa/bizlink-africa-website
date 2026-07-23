import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import KpiGrid from '@/components/admin/dashboard/KpiGrid';
import { getFinanceOverview } from '@/lib/dashboard/finance-adapters';
import { formatMoney } from '@/data/finance';
import type { Kpi } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

function growthPct(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? '+' : ''}${Math.round(pct)}%`;
}

export default async function FinanceDashboardPage() {
  try {
    await requirePermission('dashboard.finance.view');
  } catch {
    return <AccessDenied requiredPermission="dashboard.finance.view" />;
  }

  const supabase = await createClient();
  const overview = await getFinanceOverview(supabase);

  if (!overview) {
    return (
      <div>
        <h1 className="font-bold text-2xl text-[#00342b] mb-2">Financial Dashboard</h1>
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load financial data.</p>
      </div>
    );
  }

  const { currency } = overview;
  const m = (n: number) => formatMoney(n, currency);

  const revenueKpis: Kpi[] = [
    { key: 'total_revenue', label: 'Total Revenue', value: m(overview.totalRevenue), href: '/admin/finance/invoices' },
    { key: 'revenue_this_month', label: 'Revenue This Month', value: m(overview.revenueThisMonth) },
    { key: 'revenue_this_year', label: 'Annual Revenue', value: m(overview.revenueThisYear) },
    { key: 'revenue_growth', label: 'Revenue Growth (MoM)', value: growthPct(overview.revenueThisMonth, overview.revenueLastMonth) },
    { key: 'subscription_income', label: 'Subscription Income', value: m(overview.subscriptionIncome) },
    { key: 'setup_fee_income', label: 'Setup Fee Income', value: m(overview.setupFeeIncome) },
    { key: 'implementation_fee_income', label: 'Implementation Fee Income', value: m(overview.implementationFeeIncome) },
  ];

  const receivablesKpis: Kpi[] = [
    { key: 'outstanding_receivables', label: 'Outstanding Receivables', value: m(overview.outstandingReceivables), href: '/admin/finance/receivables', accent: overview.outstandingReceivables > 0 ? 'warning' : 'default' },
    { key: 'paid_invoices', label: 'Paid Invoices', value: overview.paidInvoicesCount, href: '/admin/finance/invoices', accent: 'success' },
    { key: 'unpaid_invoices', label: 'Unpaid Invoices', value: overview.unpaidInvoicesCount, href: '/admin/finance/invoices' },
    { key: 'overdue_invoices', label: 'Overdue Invoices', value: overview.overdueInvoicesCount, href: '/admin/finance/invoices', accent: overview.overdueInvoicesCount > 0 ? 'danger' : 'default' },
  ];

  const expenseKpis: Kpi[] = [
    { key: 'total_expenses', label: 'Total Expenses', value: m(overview.totalExpenses), href: '/admin/finance/expenses' },
    { key: 'expenses_this_month', label: 'Monthly Operating Costs', value: m(overview.expensesThisMonth) },
    { key: 'expense_growth', label: 'Expense Growth (MoM)', value: growthPct(overview.expensesThisMonth, overview.expensesLastMonth) },
    { key: 'pending_expense_approvals', label: 'Pending Expense Approvals', value: overview.pendingExpenseApprovalsCount, href: '/admin/finance/expense-approvals', accent: overview.pendingExpenseApprovalsCount > 0 ? 'warning' : 'default' },
    { key: 'gross_profit', label: 'Gross Profit', value: m(overview.grossProfit), accent: overview.grossProfit >= 0 ? 'success' : 'danger' },
    { key: 'net_profit', label: 'Net Profit', value: m(overview.netProfit), accent: overview.netProfit >= 0 ? 'success' : 'danger' },
    { key: 'cash_flow', label: 'Cash Flow (This Month)', value: m(overview.cashInThisMonth - overview.cashOutThisMonth), accent: overview.cashInThisMonth - overview.cashOutThisMonth >= 0 ? 'success' : 'danger' },
  ];

  const proformaKpis: Kpi[] = [
    { key: 'pending_proformas', label: 'Pending Proforma Invoices', value: overview.pendingProformasCount, href: '/admin/finance/proformas' },
    {
      key: 'proforma_conversion_rate',
      label: 'Proforma Conversion Rate',
      value: overview.totalProformasCount > 0 ? `${Math.round((overview.convertedProformasCount / overview.totalProformasCount) * 100)}%` : '—',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Financial Dashboard</h1>
        <p className="text-sm text-[#707975] mt-1">
          BizLink Africa&apos;s own revenue, receivables, and expenses. Company funds only — this is separate from
          client merchant funds, which BizLink Africa never holds (Zero-Touch Fund Management).
        </p>
      </div>

      <KpiGrid title="Revenue" kpis={revenueKpis} />
      <KpiGrid title="Receivables" kpis={receivablesKpis} />
      <KpiGrid title="Expenses & Profit" kpis={expenseKpis} />
      <KpiGrid title="Proforma Pipeline" kpis={proformaKpis} />

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-3">Cash Flow (This Month)</h2>
        <div className="flex flex-wrap gap-x-10 gap-y-2 text-sm">
          <p><span className="text-[#707975]">Cash In:</span> <span className="font-medium text-[#1b7a3d]">{m(overview.cashInThisMonth)}</span></p>
          <p><span className="text-[#707975]">Cash Out:</span> <span className="font-medium text-[#8a1f1f]">{m(overview.cashOutThisMonth)}</span></p>
          <p><span className="text-[#707975]">Net:</span> <span className="font-semibold text-[#00342b]">{m(overview.cashInThisMonth - overview.cashOutThisMonth)}</span></p>
        </div>
      </div>
    </div>
  );
}
