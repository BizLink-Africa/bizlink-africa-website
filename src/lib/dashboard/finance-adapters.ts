import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import type { TrendPoint } from './types';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface FinanceOverview {
  currency: string;
  totalRevenue: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueThisYear: number;
  subscriptionIncome: number;
  setupFeeIncome: number;
  implementationFeeIncome: number;
  outstandingReceivables: number;
  paidInvoicesCount: number;
  unpaidInvoicesCount: number;
  overdueInvoicesCount: number;
  totalExpenses: number;
  expensesThisMonth: number;
  expensesLastMonth: number;
  netProfit: number;
  grossProfit: number;
  cashInThisMonth: number;
  cashOutThisMonth: number;
  pendingProformasCount: number;
  totalProformasCount: number;
  convertedProformasCount: number;
  pendingHighValueExpensesCount: number;
  pendingExpenseApprovalsCount: number;
  revenueTrend: TrendPoint[];
}

const RECOGNIZED_REVENUE_STATUSES = ['issued', 'partially_paid', 'paid', 'overdue'];
const RECOGNIZED_EXPENSE_STATUSES = ['approved', 'paid'];
const HIGH_VALUE_EXPENSE_PENDING_STATUSES = ['submitted', 'pending_approval'];
const PENDING_EXPENSE_APPROVAL_STATUSES = ['submitted', 'pending_approval', 'pending_ceo_approval'];
// Direct delivery costs deducted for Gross Profit — everything else
// (salaries, marketing, office rent, etc.) is an operating expense that
// only affects Net Profit, which stays revenue minus ALL expenses,
// unchanged from its original formula.
const COST_OF_DELIVERY_CATEGORIES = ['hosting_infrastructure', 'software_subscriptions'];

function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

// Same trailing-N-months bucketing approach used for leads/clients in
// ceo-adapters.ts — duplicated locally rather than shared, matching this
// codebase's existing convention of small per-file utilities over a shared
// util module (see also csvEscape/csvRow duplicated across export routes).
function bucketRevenueByMonth(rows: { issue_date: string | null; total: number }[], months: number): TrendPoint[] {
  const buckets = new Map<string, number>();
  const now = new Date();
  const cursor = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  for (let i = 0; i < months; i++) {
    buckets.set(monthLabel(cursor), 0);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const windowStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  for (const row of rows) {
    if (!row.issue_date) continue;
    const d = new Date(row.issue_date);
    if (d < windowStart) continue;
    const key = monthLabel(new Date(d.getFullYear(), d.getMonth(), 1));
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + row.total);
  }
  return Array.from(buckets.entries()).map(([label, value]) => ({ label, value: Math.round(value) }));
}

export async function getFinanceOverview(supabase: Supabase): Promise<FinanceOverview | null> {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 10);
  const yearStart = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const [{ data: invoices, error: e1 }, { data: expenses, error: e2 }, { data: proformas, error: e3 }, { data: payments, error: e4 }, { data: settings }] =
    await Promise.all([
      supabase.from('invoices').select('status, total, outstanding_balance, issue_date, due_date, setup_fee, implementation_fee, subscription_fee, currency'),
      supabase.from('expenses').select('status, category, amount, expense_date'),
      supabase.from('proforma_invoices').select('status'),
      supabase.from('invoice_payments').select('amount, payment_date'),
      supabase.from('company_settings').select('default_currency, expense_high_value_threshold').eq('id', true).single(),
    ]);

  if (e1 || e2 || e3 || e4 || !invoices || !expenses || !proformas || !payments) return null;

  const currency = settings?.default_currency ?? invoices[0]?.currency ?? 'TZS';
  const recognized = invoices.filter((i) => RECOGNIZED_REVENUE_STATUSES.includes(i.status));

  const sum = (rows: { total?: number }[], key: 'total' = 'total') => rows.reduce((s, r) => s + (r[key] ?? 0), 0);

  const totalRevenue = sum(recognized);
  const revenueThisMonth = sum(recognized.filter((i) => (i.issue_date ?? '') >= monthStart));
  const revenueLastMonth = sum(
    recognized.filter((i) => (i.issue_date ?? '') >= lastMonthStart && (i.issue_date ?? '') < monthStart)
  );
  const revenueThisYear = sum(recognized.filter((i) => (i.issue_date ?? '') >= yearStart));

  const subscriptionIncome = recognized.reduce((s, i) => s + (i.subscription_fee ?? 0), 0);
  const setupFeeIncome = recognized.reduce((s, i) => s + (i.setup_fee ?? 0), 0);
  const implementationFeeIncome = recognized.reduce((s, i) => s + (i.implementation_fee ?? 0), 0);

  const outstandingReceivables = invoices
    .filter((i) => ['issued', 'partially_paid', 'overdue'].includes(i.status))
    .reduce((s, i) => s + (i.outstanding_balance ?? 0), 0);

  const paidInvoicesCount = invoices.filter((i) => i.status === 'paid').length;
  const unpaidInvoicesCount = invoices.filter((i) => ['issued', 'partially_paid', 'overdue'].includes(i.status)).length;
  const overdueInvoicesCount = invoices.filter(
    (i) => i.due_date && i.due_date < todayStr && (i.outstanding_balance ?? 0) > 0
  ).length;

  const approvedExpenses = expenses.filter((e) => RECOGNIZED_EXPENSE_STATUSES.includes(e.status));
  const totalExpenses = approvedExpenses.reduce((s, e) => s + e.amount, 0);
  const expensesThisMonth = approvedExpenses.filter((e) => e.expense_date >= monthStart).reduce((s, e) => s + e.amount, 0);
  const expensesLastMonth = approvedExpenses
    .filter((e) => e.expense_date >= lastMonthStart && e.expense_date < monthStart)
    .reduce((s, e) => s + e.amount, 0);

  const cashInThisMonth = payments.filter((p) => p.payment_date >= monthStart).reduce((s, p) => s + p.amount, 0);
  const cashOutThisMonth = expenses
    .filter((e) => e.status === 'paid' && e.expense_date >= monthStart)
    .reduce((s, e) => s + e.amount, 0);

  const highValueThreshold = settings?.expense_high_value_threshold ?? 500000;
  const pendingHighValueExpensesCount = expenses.filter(
    (e) => HIGH_VALUE_EXPENSE_PENDING_STATUSES.includes(e.status) && e.amount >= highValueThreshold
  ).length;
  const pendingExpenseApprovalsCount = expenses.filter((e) => PENDING_EXPENSE_APPROVAL_STATUSES.includes(e.status)).length;

  const costOfDelivery = approvedExpenses
    .filter((e) => COST_OF_DELIVERY_CATEGORIES.includes(e.category))
    .reduce((s, e) => s + e.amount, 0);
  const grossProfit = totalRevenue - costOfDelivery;

  const revenueTrend = bucketRevenueByMonth(
    recognized.map((i) => ({ issue_date: i.issue_date, total: i.total })),
    6
  );

  return {
    currency,
    totalRevenue,
    revenueThisMonth,
    revenueLastMonth,
    revenueThisYear,
    subscriptionIncome,
    setupFeeIncome,
    implementationFeeIncome,
    outstandingReceivables,
    paidInvoicesCount,
    unpaidInvoicesCount,
    overdueInvoicesCount,
    totalExpenses,
    expensesThisMonth,
    expensesLastMonth,
    netProfit: totalRevenue - totalExpenses,
    grossProfit,
    cashInThisMonth,
    cashOutThisMonth,
    pendingProformasCount: proformas.filter((p) => p.status === 'pending_approval').length,
    totalProformasCount: proformas.length,
    convertedProformasCount: proformas.filter((p) => p.status === 'converted').length,
    pendingHighValueExpensesCount,
    pendingExpenseApprovalsCount,
    revenueTrend,
  };
}
