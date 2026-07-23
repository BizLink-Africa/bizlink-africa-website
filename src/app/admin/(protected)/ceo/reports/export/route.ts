import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { resolveDateRange } from '@/lib/dashboard/types';
import { getExecutiveActionItems } from '@/lib/dashboard/executive-adapters';
import {
  getClientsOverview,
  getOnboardingOverview,
  getSupportOverview,
  getFinanceOverview,
  getContractsOverview,
  getLeadsOverview,
} from '@/lib/dashboard/ceo-adapters';

const VALID_TYPES = new Set([
  'company-performance',
  'revenue',
  'operations',
  'client-growth',
  'department-performance',
  'risk-alerts',
  'contract-status',
  'support-escalation',
]);

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvEscape).join(',') + '\r\n';
}

// One shared route handler for all 8 executive reports, selected by `type`
// — every report reuses the same adapters the dashboards already use, so
// none of these can drift from what's on screen (same philosophy as the
// existing ceo/export/route.ts and finance/reports/export/route.ts).
export async function GET(request: Request) {
  try {
    await requirePermission('executive.reports.export');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') ?? '';
  if (!VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
  }

  const supabase = await createClient();
  const { from: rangeFrom } = resolveDateRange('90d');

  let csv = '';

  if (type === 'company-performance') {
    const [clients, leads, finance] = await Promise.all([
      getClientsOverview(supabase, rangeFrom),
      getLeadsOverview(supabase, rangeFrom),
      getFinanceOverview(supabase),
    ]);
    csv += csvRow(['Company Performance Report']);
    csv += csvRow([`Generated: ${new Date().toISOString()}`]);
    csv += '\r\n';
    if (clients.available) {
      csv += csvRow(['Total Clients', clients.data.total]);
      csv += csvRow(['Active Clients', clients.data.active]);
    }
    if (leads.available) {
      csv += csvRow(['Total Leads', leads.data.total]);
      csv += csvRow(['Lead Conversion Rate (%)', leads.data.conversionRatePct]);
    }
    if (finance.available) {
      csv += csvRow(['Monthly Revenue', finance.data.revenueThisMonth]);
      csv += csvRow(['Annual Revenue', finance.data.revenueThisYear]);
    }
  }

  if (type === 'revenue') {
    const finance = await getFinanceOverview(supabase);
    csv += csvRow(['Revenue Report']);
    csv += '\r\n';
    if (finance.available) {
      csv += csvRow(['Metric', 'Value']);
      csv += csvRow(['Monthly Revenue', finance.data.revenueThisMonth]);
      csv += csvRow(['Annual Revenue', finance.data.revenueThisYear]);
      csv += csvRow(['Outstanding Receivables', finance.data.outstandingReceivables]);
      csv += csvRow(['Pending Proforma Invoices', finance.data.pendingProformasCount]);
      csv += csvRow(['Overdue Invoices', finance.data.overdueInvoicesCount]);
      csv += csvRow(['Pending High-Value Expenses', finance.data.pendingHighValueExpensesCount]);
    } else {
      csv += csvRow(['Finance', finance.reason]);
    }
  }

  if (type === 'operations') {
    const [onboarding, contracts] = await Promise.all([getOnboardingOverview(supabase), getContractsOverview(supabase)]);
    csv += csvRow(['Operations Report']);
    csv += '\r\n';
    if (onboarding.available) {
      csv += csvRow(['Pending Onboarding', onboarding.data.pendingCount]);
      csv += csvRow(['Delayed Onboarding', onboarding.data.delayedCount]);
    }
    if (contracts.available) {
      csv += csvRow(['Contracts Awaiting Approval', contracts.data.pendingApprovalCount]);
      csv += csvRow(['Contracts Awaiting Signature', contracts.data.awaitingSignatureCount]);
      csv += csvRow(['Contracts Expiring Soon', contracts.data.expiringSoonCount]);
    }
  }

  if (type === 'client-growth') {
    const clients = await getClientsOverview(supabase, rangeFrom);
    csv += csvRow(['Client Growth Report']);
    csv += '\r\n';
    if (clients.available) {
      csv += csvRow(['Total Clients', clients.data.total]);
      csv += csvRow(['Active Clients', clients.data.active]);
      csv += csvRow(['New Clients (90d)', clients.data.newInRange]);
      csv += '\r\n';
      csv += csvRow(['Month', 'New Clients']);
      for (const point of clients.data.growthTrend) csv += csvRow([point.label, point.value]);
    } else {
      csv += csvRow(['Clients', clients.reason]);
    }
  }

  if (type === 'department-performance') {
    const items = await getExecutiveActionItems(supabase);
    csv += csvRow(['Department Performance Report']);
    csv += '\r\n';
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.department, (counts.get(item.department) ?? 0) + 1);
    csv += csvRow(['Department', 'Open Items']);
    for (const [dept, count] of counts) csv += csvRow([dept, count]);
  }

  if (type === 'risk-alerts') {
    const items = await getExecutiveActionItems(supabase);
    csv += csvRow(['Risk & Alert Report']);
    csv += '\r\n';
    csv += csvRow(['Category', 'Title', 'Detail', 'Priority', 'Deadline']);
    for (const item of items) csv += csvRow([item.category, item.title, item.detail, item.priority, item.deadline ?? '']);
  }

  if (type === 'contract-status') {
    const { data: contracts } = await supabase
      .from('contracts')
      .select('contract_number, contract_title, status, end_date, contract_value, currency');
    csv += csvRow(['Contract Status Report']);
    csv += '\r\n';
    csv += csvRow(['Number', 'Title', 'Status', 'End Date', 'Value']);
    for (const c of contracts ?? []) {
      csv += csvRow([c.contract_number, c.contract_title, c.status, c.end_date ?? '', c.contract_value ? `${c.currency} ${c.contract_value}` : '']);
    }
  }

  if (type === 'support-escalation') {
    const support = await getSupportOverview(supabase);
    csv += csvRow(['Support Escalation Report']);
    csv += '\r\n';
    if (support.available) {
      csv += csvRow(['Open Tickets', support.data.open]);
      csv += csvRow(['Critical Tickets', support.data.critical]);
      csv += '\r\n';
      csv += csvRow(['Title', 'Detail']);
      for (const item of support.data.criticalItems) csv += csvRow([item.title, item.detail]);
    } else {
      csv += csvRow(['Support', support.reason]);
    }
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bizlink-${type}-report.csv"`,
    },
  });
}
