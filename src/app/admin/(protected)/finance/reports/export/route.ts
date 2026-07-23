import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { getFinanceOverview } from '@/lib/dashboard/finance-adapters';
import { FEE_FIELDS, AGING_BUCKETS, daysOverdue, type FeeFieldKey } from '@/data/finance';

const ADDITIONAL_REPORT_TYPES = new Set([
  'revenue-by-service', 'revenue-by-client', 'expense-by-category', 'receivables-aging',
  'proforma-conversion', 'invoice-payment-status', 'monthly-summary', 'annual-summary',
]);

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvEscape).join(',') + '\r\n';
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// The 8 additional report types, each a focused CSV over live data — same
// idiom as the Operations Reports export route. Kept in this one route
// handler (selected by `type`) rather than one route per report, matching
// how the CRM/Operations report exports already do it.
async function buildAdditionalReportCsv(type: string, supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  let csv = '';

  if (type === 'revenue-by-service') {
    const { data: invoices } = await supabase
      .from('invoices')
      .select(FEE_FIELDS.map((f) => f.key).join(', '))
      .in('status', ['issued', 'partially_paid', 'paid', 'overdue']);
    const rows = (invoices ?? []) as unknown as Record<FeeFieldKey, number>[];
    csv += csvRow(['Revenue by Service']);
    csv += csvRow(['Category', 'Total']);
    for (const field of FEE_FIELDS) {
      csv += csvRow([field.label, rows.reduce((s, r) => s + (r[field.key] ?? 0), 0)]);
    }
  }

  if (type === 'revenue-by-client') {
    const { data: invoices } = await supabase
      .from('invoices')
      .select('client_business_name, total')
      .in('status', ['issued', 'partially_paid', 'paid', 'overdue']);
    const totals = new Map<string, number>();
    for (const inv of invoices ?? []) {
      totals.set(inv.client_business_name, (totals.get(inv.client_business_name) ?? 0) + inv.total);
    }
    csv += csvRow(['Revenue by Client']);
    csv += csvRow(['Client', 'Total']);
    for (const [client, total] of Array.from(totals.entries()).sort((a, b) => b[1] - a[1])) {
      csv += csvRow([client, total]);
    }
  }

  if (type === 'expense-by-category') {
    const { data: expenses } = await supabase.from('expenses').select('category, amount').in('status', ['approved', 'paid']);
    const totals = new Map<string, number>();
    for (const e of expenses ?? []) {
      totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
    }
    csv += csvRow(['Expense by Category']);
    csv += csvRow(['Category', 'Total']);
    for (const [category, total] of Array.from(totals.entries()).sort((a, b) => b[1] - a[1])) {
      csv += csvRow([category, total]);
    }
  }

  if (type === 'receivables-aging') {
    const today = new Date().toISOString().slice(0, 10);
    const { data: invoices } = await supabase
      .from('invoices')
      .select('invoice_number, client_business_name, outstanding_balance, due_date')
      .in('status', ['issued', 'partially_paid', 'overdue'])
      .gt('outstanding_balance', 0);
    csv += csvRow(['Receivables Aging']);
    csv += csvRow(['Invoice', 'Client', 'Outstanding', 'Due Date', 'Days Overdue', 'Bucket']);
    for (const inv of invoices ?? []) {
      const days = daysOverdue(inv.due_date, today);
      const bucket = AGING_BUCKETS.find((b) => b.test(days))?.label ?? '';
      csv += csvRow([inv.invoice_number, inv.client_business_name, inv.outstanding_balance, inv.due_date ?? '', days > 0 ? days : 0, bucket]);
    }
  }

  if (type === 'proforma-conversion') {
    const { data: proformas } = await supabase
      .from('proforma_invoices')
      .select('proforma_number, client_business_name, status, total, converted_invoice_id, invoices:converted_invoice_id(invoice_number)');
    csv += csvRow(['Proforma Conversion']);
    csv += csvRow(['Proforma', 'Client', 'Status', 'Total', 'Converted Invoice']);
    for (const p of (proformas ?? []) as unknown as { proforma_number: string; client_business_name: string; status: string; total: number; invoices: { invoice_number: string } | null }[]) {
      csv += csvRow([p.proforma_number, p.client_business_name, p.status, p.total, p.invoices?.invoice_number ?? '']);
    }
  }

  if (type === 'invoice-payment-status') {
    const { data: invoices } = await supabase.from('invoices').select('invoice_number, client_business_name, status, total, amount_paid, outstanding_balance');
    csv += csvRow(['Invoice Payment Status']);
    csv += csvRow(['Invoice', 'Client', 'Status', 'Total', 'Amount Paid', 'Outstanding']);
    for (const inv of invoices ?? []) {
      csv += csvRow([inv.invoice_number, inv.client_business_name, inv.status, inv.total, inv.amount_paid, inv.outstanding_balance]);
    }
  }

  if (type === 'monthly-summary' || type === 'annual-summary') {
    const months = type === 'monthly-summary' ? 12 : 60;
    const today = new Date();
    const windowStart = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1).toISOString().slice(0, 10);
    const [{ data: invoices }, { data: expenses }] = await Promise.all([
      supabase.from('invoices').select('total, issue_date').in('status', ['issued', 'partially_paid', 'paid', 'overdue']).gte('issue_date', windowStart),
      supabase.from('expenses').select('amount, expense_date').in('status', ['approved', 'paid']).gte('expense_date', windowStart),
    ]);

    const revenueByPeriod = new Map<string, number>();
    const expenseByPeriod = new Map<string, number>();
    for (const inv of invoices ?? []) {
      if (!inv.issue_date) continue;
      const d = new Date(inv.issue_date);
      const key = type === 'annual-summary' ? String(d.getFullYear()) : monthKey(d);
      revenueByPeriod.set(key, (revenueByPeriod.get(key) ?? 0) + inv.total);
    }
    for (const e of expenses ?? []) {
      const d = new Date(e.expense_date);
      const key = type === 'annual-summary' ? String(d.getFullYear()) : monthKey(d);
      expenseByPeriod.set(key, (expenseByPeriod.get(key) ?? 0) + e.amount);
    }

    const periods = Array.from(new Set([...revenueByPeriod.keys(), ...expenseByPeriod.keys()])).sort();
    csv += csvRow([type === 'annual-summary' ? 'Annual Summary' : 'Monthly Summary']);
    csv += csvRow(['Period', 'Revenue', 'Expenses', 'Net Profit']);
    for (const period of periods) {
      const revenue = revenueByPeriod.get(period) ?? 0;
      const expense = expenseByPeriod.get(period) ?? 0;
      csv += csvRow([period, revenue, expense, revenue - expense]);
    }
  }

  return csv;
}

export async function GET(request: Request) {
  try {
    await requirePermission('finance.reports.export');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  const supabase = await createClient();

  if (type && ADDITIONAL_REPORT_TYPES.has(type)) {
    const csv = await buildAdditionalReportCsv(type, supabase);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="bizlink-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const overview = await getFinanceOverview(supabase);

  if (!overview) {
    return NextResponse.json({ error: 'Failed to load financial data' }, { status: 500 });
  }

  let csv = csvRow(['BizLink Africa — Financial Report']);
  csv += csvRow([`Generated: ${new Date().toISOString()}`, `Currency: ${overview.currency}`]);
  csv += '\r\n';

  csv += csvRow(['Profit & Loss']);
  csv += csvRow(['Total Revenue', overview.totalRevenue]);
  csv += csvRow(['Subscription Income', overview.subscriptionIncome]);
  csv += csvRow(['Setup Fee Income', overview.setupFeeIncome]);
  csv += csvRow(['Implementation Fee Income', overview.implementationFeeIncome]);
  csv += csvRow(['Total Expenses', overview.totalExpenses]);
  csv += csvRow(['Net Profit', overview.netProfit]);
  csv += '\r\n';

  csv += csvRow(['Cash Flow (This Month)']);
  csv += csvRow(['Cash In', overview.cashInThisMonth]);
  csv += csvRow(['Cash Out', overview.cashOutThisMonth]);
  csv += csvRow(['Net Cash Flow', overview.cashInThisMonth - overview.cashOutThisMonth]);
  csv += '\r\n';

  csv += csvRow(['Receivables & Proforma Pipeline']);
  csv += csvRow(['Outstanding Receivables', overview.outstandingReceivables]);
  csv += csvRow(['Paid Invoices', overview.paidInvoicesCount]);
  csv += csvRow(['Unpaid Invoices', overview.unpaidInvoicesCount]);
  csv += csvRow(['Overdue Invoices', overview.overdueInvoicesCount]);
  csv += csvRow(['Pending Proforma Invoices', overview.pendingProformasCount]);
  csv += csvRow([
    'Proforma Conversion Rate (%)',
    overview.totalProformasCount > 0 ? Math.round((overview.convertedProformasCount / overview.totalProformasCount) * 100) : 0,
  ]);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bizlink-financial-report-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
