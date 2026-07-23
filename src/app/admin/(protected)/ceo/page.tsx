import { Download } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import KpiGrid from '@/components/admin/dashboard/KpiGrid';
import BarListChart from '@/components/admin/dashboard/BarListChart';
import TrendLineChart from '@/components/admin/dashboard/TrendLineChart';
import ModuleUnavailableCard from '@/components/admin/dashboard/ModuleUnavailableCard';
import DateRangeFilter from '@/components/admin/dashboard/DateRangeFilter';
import { resolveDateRange, type DateRangeKey, type Kpi } from '@/lib/dashboard/types';
import { formatMoney } from '@/data/finance';
import { EXECUTIVE_UNAVAILABLE } from '@/lib/dashboard/executive-adapters';
import {
  getClientsOverview,
  getLeadsOverview,
  getOnboardingOverview,
  getSupportOverview,
  getTechnicalOverview,
  getServicesOverview,
  getFinanceOverview,
  getContractsOverview,
  getComplianceOverview,
  getSecurityOverview,
  getMarketingOverview,
  INQUIRY_STATUSES,
  API_STATUSES,
  TICKET_STATUSES,
} from '@/lib/dashboard/ceo-adapters';

export const dynamic = 'force-dynamic';

interface PageSearchParams {
  range?: string;
}

const VALID_RANGES = new Set(['7d', '30d', '90d', 'ytd']);

export default async function CeoDashboardPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  try {
    await requirePermission('dashboard.ceo.view');
  } catch {
    return <AccessDenied requiredPermission="dashboard.ceo.view" />;
  }

  const params = await searchParams;
  const rangeKey: DateRangeKey = VALID_RANGES.has(params.range ?? '') ? (params.range as DateRangeKey) : '30d';
  const { from: rangeFrom, label: rangeLabel } = resolveDateRange(rangeKey);

  const supabase = await createClient();

  const [clients, leads, onboarding, support, technical, services, finance, contracts, compliance, security, marketing] = await Promise.all([
    getClientsOverview(supabase, rangeFrom),
    getLeadsOverview(supabase, rangeFrom),
    getOnboardingOverview(supabase),
    getSupportOverview(supabase),
    getTechnicalOverview(supabase),
    getServicesOverview(supabase),
    getFinanceOverview(supabase),
    getContractsOverview(supabase),
    getComplianceOverview(supabase),
    getSecurityOverview(supabase),
    getMarketingOverview(supabase),
  ]);

  const currency = finance.available ? finance.data.currency : 'TZS';
  const m = (n: number) => formatMoney(n, currency);

  const businessKpis: Kpi[] = [];
  if (clients.available) {
    businessKpis.push(
      { key: 'total_clients', label: 'Total Clients', value: clients.data.total, href: '/admin/clients' },
      { key: 'active_clients', label: 'Active Clients', value: clients.data.active, href: '/admin/clients', accent: 'success' },
      { key: 'new_clients', label: `New Clients (${rangeLabel})`, value: clients.data.newInRange }
    );
  }
  if (leads.available) {
    businessKpis.push(
      { key: 'total_leads', label: 'Total Leads', value: leads.data.total, href: '/admin/inquiries' },
      { key: 'conversion_rate', label: 'Lead Conversion Rate', value: `${leads.data.conversionRatePct}%` }
    );
  }
  if (services.available) {
    businessKpis.push({ key: 'active_services', label: 'Active Services', value: services.data.active, href: '/admin/services' });
  }

  const financeKpis: Kpi[] = [];
  if (finance.available) {
    financeKpis.push(
      { key: 'monthly_revenue', label: 'Monthly Revenue', value: m(finance.data.revenueThisMonth) },
      { key: 'annual_revenue', label: 'Annual Revenue', value: m(finance.data.revenueThisYear) },
      { key: 'outstanding_receivables', label: 'Outstanding Receivables', value: m(finance.data.outstandingReceivables), href: '/admin/finance/receivables' },
      {
        key: 'overdue_invoices',
        label: 'Overdue Invoices',
        value: finance.data.overdueInvoicesCount,
        href: '/admin/finance/invoices',
        accent: finance.data.overdueInvoicesCount > 0 ? 'danger' : 'default',
      },
      { key: 'pending_proformas', label: 'Pending Proforma Invoices', value: finance.data.pendingProformasCount, href: '/admin/finance/proformas' },
      {
        key: 'pending_high_value_expenses',
        label: 'Pending High-Value Expenses',
        value: finance.data.pendingHighValueExpensesCount,
        href: '/admin/finance/expenses',
        accent: finance.data.pendingHighValueExpensesCount > 0 ? 'warning' : 'default',
      }
    );
  }

  const operationsKpis: Kpi[] = [];
  if (onboarding.available) {
    operationsKpis.push(
      { key: 'pending_onboarding', label: 'Pending Onboarding', value: onboarding.data.pendingCount, href: '/admin/onboarding' },
      {
        key: 'delayed_onboarding',
        label: 'Delayed Onboarding',
        value: onboarding.data.delayedCount,
        accent: onboarding.data.delayedCount > 0 ? 'danger' : 'default',
      }
    );
  }
  if (contracts.available) {
    operationsKpis.push(
      { key: 'contracts_pending_approval', label: 'Contracts Awaiting Approval', value: contracts.data.pendingApprovalCount, href: '/admin/contracts' },
      { key: 'contracts_awaiting_signature', label: 'Contracts Awaiting Signature', value: contracts.data.awaitingSignatureCount, href: '/admin/contracts' }
    );
  }

  const marketingKpis: Kpi[] = [];
  if (marketing.available) {
    marketingKpis.push(
      { key: 'active_campaigns', label: 'Active Campaigns', value: marketing.data.activeCampaignsCount, href: '/admin/marketing/campaigns' },
      { key: 'marketing_leads', label: 'Marketing Leads', value: marketing.data.totalLeadsCount, href: '/admin/marketing/leads' }
    );
  }

  const supportKpis: Kpi[] = [];
  if (support.available) {
    supportKpis.push(
      { key: 'open_tickets', label: 'Open Tickets', value: support.data.open, href: '/admin/support-tickets' },
      {
        key: 'critical_tickets',
        label: 'Critical Tickets',
        value: support.data.critical,
        accent: support.data.critical > 0 ? 'danger' : 'default',
        href: '/admin/support-tickets',
      }
    );
  }

  const technologyKpis: Kpi[] = [];
  if (technical.available) {
    technologyKpis.push(
      { key: 'active_integrations', label: 'Active Integrations', value: technical.data.active, href: '/admin/integration-health', accent: 'success' },
      {
        key: 'failed_integrations',
        label: 'Failed Integrations',
        value: technical.data.failed,
        accent: technical.data.failed > 0 ? 'danger' : 'default',
        href: '/admin/integration-health',
      },
      { key: 'active_ai_agents', label: 'Active AI Agents', value: technical.data.activeAgents, href: '/admin/ai-agents', accent: 'success' }
    );
  }

  const complianceKpis: Kpi[] = [];
  if (compliance.available) {
    complianceKpis.push(
      { key: 'pending_reviews', label: 'Pending Compliance Reviews', value: compliance.data.pendingReviewsCount, href: '/admin/compliance/reviews' },
      { key: 'compliance_issues', label: 'Compliance Issues', value: compliance.data.openComplianceIssuesCount, href: '/admin/compliance/reviews', accent: compliance.data.openComplianceIssuesCount > 0 ? 'warning' : 'default' }
    );
  }
  if (security.available) {
    complianceKpis.push(
      { key: 'security_alerts', label: 'Security Alerts', value: security.data.securityRisksCount, href: '/admin/compliance/security-events', accent: security.data.securityRisksCount > 0 ? 'warning' : 'default' },
      { key: 'failed_login_alerts', label: 'Failed Login Alerts', value: security.data.failedLoginsCount, href: '/admin/security/logins' },
      { key: 'open_security_incidents', label: 'Open Security Events', value: security.data.openSecurityEventsCount, href: '/admin/compliance/security-events', accent: security.data.openSecurityEventsCount > 0 ? 'danger' : 'default' }
    );
  }

  const leadStatusChart = leads.available
    ? INQUIRY_STATUSES.map((s) => ({ label: s.label, value: leads.data.statusCounts[s.value] ?? 0 }))
    : [];
  const ticketStatusChart = support.available
    ? TICKET_STATUSES.map((s) => ({ label: s.label, value: support.data.statusCounts[s.value] ?? 0 }))
    : [];
  const integrationStatusChart = technical.available
    ? API_STATUSES.map((s) => ({ label: s.label, value: technical.data.statusCounts[s.value] ?? 0 }))
    : [];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">CEO Dashboard</h1>
          <p className="text-sm text-[#707975] mt-1">Full business overview and executive action center.</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeFilter current={rangeKey} />
          <a
            href={`/admin/ceo/export?range=${rangeKey}`}
            className="inline-flex items-center gap-2 border border-[#00342b] text-[#00342b] px-4 py-2 text-sm font-medium hover:bg-[#00342b] hover:text-white transition-colors"
          >
            <Download size={14} /> Export Report
          </a>
        </div>
      </div>

      {businessKpis.length > 0 && <KpiGrid title="Business" kpis={businessKpis} />}
      {financeKpis.length > 0 && <KpiGrid title="Finance" kpis={financeKpis} />}
      {operationsKpis.length > 0 && <KpiGrid title="Operations" kpis={operationsKpis} />}
      {marketingKpis.length > 0 && <KpiGrid title="Marketing" kpis={marketingKpis} />}
      {supportKpis.length > 0 && <KpiGrid title="Customer Support" kpis={supportKpis} />}
      {technologyKpis.length > 0 && <KpiGrid title="Technology" kpis={technologyKpis} />}
      {complianceKpis.length > 0 && <KpiGrid title="Compliance & Security" kpis={complianceKpis} />}

      <div>
        <h2 className="font-semibold text-[#00342b] mb-3">Not Yet Available</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EXECUTIVE_UNAVAILABLE.map((u) => (
            <ModuleUnavailableCard key={u.moduleLabel} title={u.moduleLabel} reason={u.reason} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {leads.available && <TrendLineChart title="Lead Volume Trend (6 months)" data={leads.data.trend} />}
        {clients.available && <TrendLineChart title="Client Growth Trend (6 months)" data={clients.data.growthTrend} />}
        {finance.available && <TrendLineChart title="Revenue Trend (6 months)" data={finance.data.revenueTrend} />}
        {leads.available && <BarListChart title="Leads by Stage" data={leadStatusChart} />}
        {support.available && <BarListChart title="Support Tickets by Status" data={ticketStatusChart} />}
        {technical.available && <BarListChart title="Integrations by Status" data={integrationStatusChart} />}
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-2">Executive Action Center</h2>
        <p className="text-sm text-[#707975]">
          Contracts, expenses, invoices, onboarding, support, technical, and compliance items needing your decision now
          live in one place.
        </p>
        <a href="/admin/ceo/actions" className="inline-block mt-3 text-sm font-medium text-[#00342b] hover:underline">
          Open Executive Action Center →
        </a>
      </div>
    </div>
  );
}
