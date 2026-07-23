import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import KpiGrid from '@/components/admin/dashboard/KpiGrid';
import { getMarketingOverview } from '@/lib/dashboard/marketing-adapters';
import { formatMoney } from '@/data/finance';
import { labelFor, CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES } from '@/data/marketing';
import type { Kpi } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

export default async function MarketingDashboardPage() {
  try {
    await requirePermission('dashboard.marketing.view');
  } catch {
    return <AccessDenied requiredPermission="dashboard.marketing.view" />;
  }

  const supabase = await createClient();
  const overview = await getMarketingOverview(supabase);

  if (!overview) {
    return (
      <div>
        <h1 className="font-bold text-2xl text-[#00342b] mb-2">Marketing Dashboard</h1>
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load marketing data.</p>
      </div>
    );
  }

  const m = (n: number) => formatMoney(n, overview.currency);

  const leadKpis: Kpi[] = [
    { key: 'total_marketing_leads', label: 'Total Marketing Leads', value: overview.totalLeadsCount, href: '/admin/marketing/leads' },
    { key: 'new_marketing_leads', label: 'New Marketing Leads', value: overview.newLeadsCount, href: '/admin/marketing/leads' },
    { key: 'mql', label: 'Marketing-Qualified Leads', value: overview.mqlCount, href: '/admin/marketing/leads' },
    { key: 'sql', label: 'Sales-Qualified Leads', value: overview.sqlCount, href: '/admin/marketing/leads' },
    { key: 'lead_conversion_rate', label: 'Lead Conversion Rate', value: `${overview.leadConversionRate}%` },
  ];

  const sourceKpis: Kpi[] = [
    { key: 'website_inquiries', label: 'Website Inquiries', value: overview.websiteLeadsCount },
    { key: 'social_media_leads', label: 'Social Media Leads', value: overview.socialMediaLeadsCount },
    { key: 'referral_leads', label: 'Referral Leads', value: overview.referralLeadsCount },
    { key: 'partnership_leads', label: 'Partnership Leads', value: overview.partnershipLeadsCount },
  ];

  const campaignKpis: Kpi[] = [
    { key: 'active_campaigns', label: 'Active Campaigns', value: overview.activeCampaignsCount, href: '/admin/marketing/campaigns' },
    { key: 'campaign_spend', label: 'Campaign Spend', value: m(overview.totalActualSpend) },
    { key: 'campaign_attributed_revenue', label: 'Campaign-Attributed Revenue', value: m(overview.campaignAttributedRevenue), accent: 'success' },
    { key: 'cost_per_lead', label: 'Cost Per Lead', value: overview.costPerLead !== null ? m(overview.costPerLead) : '—' },
    { key: 'cost_per_acquisition', label: 'Cost Per Acquisition', value: overview.costPerAcquisition !== null ? m(overview.costPerAcquisition) : '—' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Marketing Dashboard</h1>
        <p className="text-sm text-[#707975] mt-1">BizLink Africa&apos;s own lead-generation and growth campaigns.</p>
      </div>

      <KpiGrid title="Leads" kpis={leadKpis} />
      <KpiGrid title="Lead Sources" kpis={sourceKpis} />
      <KpiGrid title="Campaigns" kpis={campaignKpis} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white border border-[#bfc9c4] p-6">
          <h2 className="font-semibold text-[#00342b] mb-3">Best-Performing Campaign</h2>
          {overview.bestCampaign ? (
            <p className="text-sm text-[#3f4945]">
              <span className="font-medium text-[#00342b]">{overview.bestCampaign.name}</span> — {m(overview.bestCampaign.revenue)} attributed revenue
            </p>
          ) : (
            <p className="text-sm text-[#707975]">No campaign has attributed revenue yet.</p>
          )}
        </div>
        <div className="bg-white border border-[#bfc9c4] p-6">
          <h2 className="font-semibold text-[#00342b] mb-3">Best-Performing Channel</h2>
          {overview.bestChannel ? (
            <p className="text-sm text-[#3f4945]">
              <span className="font-medium text-[#00342b]">{labelFor(CAMPAIGN_CHANNELS, overview.bestChannel.channel)}</span> — {m(overview.bestChannel.revenue)} attributed revenue
            </p>
          ) : (
            <p className="text-sm text-[#707975]">No channel has attributed revenue yet.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white border border-[#bfc9c4] p-6">
          <h2 className="font-semibold text-[#00342b] mb-3">Campaigns by Channel</h2>
          <div className="space-y-2 text-sm">
            {overview.byChannel.length === 0 && <p className="text-[#707975]">No campaigns yet.</p>}
            {overview.byChannel.map((row) => (
              <div key={row.channel} className="flex justify-between border-b border-[#e5e5e5] last:border-0 py-1.5">
                <span className="text-[#3f4945]">{labelFor(CAMPAIGN_CHANNELS, row.channel)}</span>
                <span className="text-[#707975]">{row.count} campaign{row.count === 1 ? '' : 's'}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border border-[#bfc9c4] p-6">
          <h2 className="font-semibold text-[#00342b] mb-3">Campaigns by Status</h2>
          <div className="space-y-2 text-sm">
            {overview.byStatus.length === 0 && <p className="text-[#707975]">No campaigns yet.</p>}
            {overview.byStatus.map((row) => (
              <div key={row.status} className="flex justify-between border-b border-[#e5e5e5] last:border-0 py-1.5">
                <span className="text-[#3f4945]">{labelFor(CAMPAIGN_STATUSES, row.status)}</span>
                <span className="text-[#707975]">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
