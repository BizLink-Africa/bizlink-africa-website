import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { resolveDateRange, type DateRangeKey } from '@/lib/dashboard/types';
import {
  getClientsOverview,
  getLeadsOverview,
  getOnboardingOverview,
  getSupportOverview,
  getTechnicalOverview,
  getFinanceOverview,
  getContractsOverview,
  getComplianceOverview,
  getSecurityOverview,
  getMarketingOverview,
} from '@/lib/dashboard/ceo-adapters';

const VALID_RANGES = new Set(['7d', '30d', '90d', 'ytd']);

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvEscape).join(',') + '\r\n';
}

// Real export of exactly what's on the CEO Dashboard for the selected
// range — no separate reporting pipeline, so it can never drift from what
// the dashboard shows.
export async function GET(request: Request) {
  try {
    await requirePermission('dashboard.ceo.view');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const rangeKey: DateRangeKey = VALID_RANGES.has(searchParams.get('range') ?? '')
    ? (searchParams.get('range') as DateRangeKey)
    : '30d';
  const { from: rangeFrom, label: rangeLabel } = resolveDateRange(rangeKey);

  const supabase = await createClient();
  const [clients, leads, onboarding, support, technical, finance, contracts, compliance, security, marketing] = await Promise.all([
    getClientsOverview(supabase, rangeFrom),
    getLeadsOverview(supabase, rangeFrom),
    getOnboardingOverview(supabase),
    getSupportOverview(supabase),
    getTechnicalOverview(supabase),
    getFinanceOverview(supabase),
    getContractsOverview(supabase),
    getComplianceOverview(supabase),
    getSecurityOverview(supabase),
    getMarketingOverview(supabase),
  ]);

  let csv = csvRow(['BizLink Africa — CEO Dashboard Export']);
  csv += csvRow([`Range: ${rangeLabel}`, `Generated: ${new Date().toISOString()}`]);
  csv += '\r\n';

  csv += csvRow(['Metric', 'Value']);
  if (clients.available) {
    csv += csvRow(['Total Clients', clients.data.total]);
    csv += csvRow(['Active Clients', clients.data.active]);
    csv += csvRow([`New Clients (${rangeLabel})`, clients.data.newInRange]);
  }
  if (leads.available) {
    csv += csvRow(['Total Leads', leads.data.total]);
    csv += csvRow([`New Leads (${rangeLabel})`, leads.data.newInRange]);
    csv += csvRow(['Lead Conversion Rate (%)', leads.data.conversionRatePct]);
  }
  if (onboarding.available) {
    csv += csvRow(['Pending Onboarding', onboarding.data.pendingCount]);
    csv += csvRow(['Delayed Onboarding', onboarding.data.delayedCount]);
  }
  if (support.available) {
    csv += csvRow(['Open Support Tickets', support.data.open]);
    csv += csvRow(['Critical Tickets', support.data.critical]);
  }
  if (technical.available) {
    csv += csvRow(['Active Integrations', technical.data.active]);
    csv += csvRow(['Failed Integrations', technical.data.failed]);
  }

  csv += '\r\n';
  if (finance.available) {
    csv += csvRow(['Monthly Revenue', finance.data.revenueThisMonth]);
    csv += csvRow(['Annual Revenue', finance.data.revenueThisYear]);
    csv += csvRow(['Outstanding Receivables', finance.data.outstandingReceivables]);
    csv += csvRow(['Overdue Invoices', finance.data.overdueInvoicesCount]);
    csv += csvRow(['Pending Proforma Invoices', finance.data.pendingProformasCount]);
    csv += csvRow(['Pending High-Value Expenses', finance.data.pendingHighValueExpensesCount]);
  } else {
    csv += csvRow(['Finance', finance.reason]);
  }
  if (contracts.available) {
    csv += csvRow(['Contracts Awaiting Approval', contracts.data.pendingApprovalCount]);
    csv += csvRow(['Contracts Awaiting Signature', contracts.data.awaitingSignatureCount]);
    csv += csvRow(['Contracts Expiring Soon', contracts.data.expiringSoonCount]);
  } else {
    csv += csvRow(['Contracts', contracts.reason]);
  }
  if (marketing.available) {
    csv += csvRow(['Active Campaigns', marketing.data.activeCampaignsCount]);
    csv += csvRow(['Marketing Leads', marketing.data.totalLeadsCount]);
  } else {
    csv += csvRow(['Marketing', marketing.reason]);
  }
  if (compliance.available) {
    csv += csvRow(['Pending Compliance Reviews', compliance.data.pendingReviewsCount]);
    csv += csvRow(['Compliance Issues', compliance.data.openComplianceIssuesCount]);
  } else {
    csv += csvRow(['Compliance', compliance.reason]);
  }
  if (security.available) {
    csv += csvRow(['Security Alerts', security.data.securityRisksCount]);
    csv += csvRow(['Open Security Events', security.data.openSecurityEventsCount]);
    csv += csvRow(['Failed Login Alerts', security.data.failedLoginsCount]);
  } else {
    csv += csvRow(['Security', security.reason]);
  }

  if (onboarding.available && onboarding.data.delayedItems.length > 0) {
    csv += '\r\n';
    csv += csvRow(['Delayed Onboarding Cases']);
    csv += csvRow(['Business', 'Detail']);
    for (const item of onboarding.data.delayedItems) csv += csvRow([item.title, item.detail]);
  }

  if (support.available && support.data.criticalItems.length > 0) {
    csv += '\r\n';
    csv += csvRow(['Critical Support Tickets']);
    csv += csvRow(['Title', 'Detail']);
    for (const item of support.data.criticalItems) csv += csvRow([item.title, item.detail]);
  }

  if (technical.available && technical.data.failedItems.length > 0) {
    csv += '\r\n';
    csv += csvRow(['Failed Integrations']);
    csv += csvRow(['Service', 'Detail']);
    for (const item of technical.data.failedItems) csv += csvRow([item.title, item.detail]);
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bizlink-ceo-report-${rangeKey}.csv"`,
    },
  });
}
