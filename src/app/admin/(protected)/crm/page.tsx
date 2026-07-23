import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import KpiGrid from '@/components/admin/dashboard/KpiGrid';
import { resolveDateRange, type Kpi } from '@/lib/dashboard/types';
import { formatMoney } from '@/data/finance';
import { getCrmOverview } from '@/lib/dashboard/crm-adapters';

export const dynamic = 'force-dynamic';

export default async function CrmDashboardPage() {
  try {
    await requirePermission('dashboard.crm.view');
  } catch {
    return <AccessDenied requiredPermission="dashboard.crm.view" />;
  }

  const supabase = await createClient();
  const { from: rangeFrom, label: rangeLabel } = resolveDateRange('30d');
  const overview = await getCrmOverview(supabase, rangeFrom);

  if (!overview) {
    return (
      <div>
        <h1 className="font-bold text-2xl text-[#00342b] mb-2">CRM Dashboard</h1>
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load CRM data.</p>
      </div>
    );
  }

  const m = (n: number) => formatMoney(n, overview.currency);

  const leadKpis: Kpi[] = [
    { key: 'total_leads', label: 'Total Leads', value: overview.totalLeads, href: '/admin/inquiries' },
    { key: 'new_leads', label: `New Leads (${rangeLabel})`, value: overview.newLeads, href: '/admin/inquiries' },
    { key: 'qualified_leads', label: 'Qualified Leads', value: overview.qualifiedLeads, href: '/admin/inquiries' },
    { key: 'sales_qualified_leads', label: 'Sales-Qualified Leads', value: overview.salesQualifiedLeads, href: '/admin/inquiries' },
    { key: 'converted_leads', label: 'Converted Leads', value: overview.convertedLeads, accent: 'success', href: '/admin/inquiries' },
    { key: 'lost_leads', label: 'Lost Leads', value: overview.lostLeads, accent: overview.lostLeads > 0 ? 'warning' : 'default', href: '/admin/inquiries' },
    { key: 'lead_conversion_rate', label: 'Lead Conversion Rate', value: `${overview.leadConversionRatePct}%` },
  ];

  const pipelineKpis: Kpi[] = [
    { key: 'active_opportunities', label: 'Active Opportunities', value: overview.activeOpportunities, href: '/admin/crm/opportunities' },
    { key: 'opportunity_value', label: 'Opportunity Value', value: m(overview.opportunityValue), href: '/admin/crm/pipeline' },
    { key: 'new_clients', label: `New Clients (${rangeLabel})`, value: overview.newClients, href: '/admin/clients' },
    { key: 'follow_ups_due', label: 'Follow-ups Due', value: overview.followUpsDue, href: '/admin/crm/follow-ups', accent: overview.followUpsDue > 0 ? 'warning' : 'default' },
    { key: 'proposals_pending', label: 'Proposals Pending', value: overview.proposalsPending, href: '/admin/crm/proposals' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">CRM Dashboard</h1>
        <p className="text-sm text-[#707975] mt-1">Leads, opportunities, and the sales pipeline in one place.</p>
      </div>

      <KpiGrid title="Leads" kpis={leadKpis} />
      <KpiGrid title="Pipeline" kpis={pipelineKpis} />

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-2">Sales Pipeline</h2>
        <p className="text-sm text-[#707975]">Leads and opportunities by stage, expected close dates, and overdue follow-ups.</p>
        <Link href="/admin/crm/pipeline" className="inline-block mt-3 text-sm font-medium text-[#00342b] hover:underline">
          Open Sales Pipeline →
        </Link>
      </div>
    </div>
  );
}
