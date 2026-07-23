import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import BarListChart from '@/components/admin/dashboard/BarListChart';
import TrendLineChart from '@/components/admin/dashboard/TrendLineChart';
import { getCampaignAttributionMap } from '@/lib/dashboard/marketing-adapters';
import { LEAD_SOURCES, LEAD_STAGES, labelFor as labelForSource } from '@/data/inquiries';
import type { TrendPoint } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

function bucketSpendByMonth(rows: { start_date: string | null; actual_spend: number }[], months: number): TrendPoint[] {
  const buckets = new Map<string, number>();
  const now = new Date();
  const cursor = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  for (let i = 0; i < months; i++) {
    buckets.set(monthLabel(cursor), 0);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const windowStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  for (const row of rows) {
    if (!row.start_date) continue;
    const d = new Date(row.start_date);
    if (d < windowStart) continue;
    const key = monthLabel(new Date(d.getFullYear(), d.getMonth(), 1));
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + row.actual_spend);
  }
  return Array.from(buckets.entries()).map(([label, value]) => ({ label, value: Math.round(value) }));
}

export default async function CampaignAnalyticsPage() {
  try {
    await requirePermission('marketing.analytics.view');
  } catch {
    return <AccessDenied requiredPermission="marketing.analytics.view" />;
  }

  const supabase = await createClient();
  const [{ data: leads }, { data: campaigns }] = await Promise.all([
    supabase.from('website_leads').select('lead_source, stage'),
    supabase.from('marketing_campaigns').select('id, name, start_date, actual_spend'),
  ]);

  const attribution = await getCampaignAttributionMap(supabase);
  const leadRows = leads ?? [];
  const campaignRows = campaigns ?? [];

  const leadsBySource = LEAD_SOURCES.map((s) => ({
    label: labelForSource(LEAD_SOURCES, s.value),
    value: leadRows.filter((l) => l.lead_source === s.value).length,
  }));

  const conversionBySource = LEAD_SOURCES.map((s) => {
    const sourceLeads = leadRows.filter((l) => l.lead_source === s.value);
    // Not attribution-chain-derived (no per-lead conversion flag exists) —
    // uses each lead's own stage as a coarse proxy: 'won' means converted.
    const converted = sourceLeads.filter((l) => l.stage === 'won').length;
    return { label: labelForSource(LEAD_SOURCES, s.value), value: sourceLeads.length > 0 ? Math.round((converted / sourceLeads.length) * 100) : 0 };
  });

  const campaignPerformance = campaignRows.map((c) => ({ label: c.name, value: attribution.get(c.id)?.leadsCount ?? 0 }));
  const attributedRevenueByCampaign = campaignRows.map((c) => ({ label: c.name, value: Math.round(attribution.get(c.id)?.attributedRevenue ?? 0) }));

  const costPerLeadByCampaign = campaignRows.map((c) => {
    const leadsCount = attribution.get(c.id)?.leadsCount ?? 0;
    return { label: c.name, value: leadsCount > 0 ? Math.round((c.actual_spend / leadsCount) * 100) / 100 : 0 };
  });
  const costPerAcquisitionByCampaign = campaignRows.map((c) => {
    const conversions = attribution.get(c.id)?.conversionsCount ?? 0;
    return { label: c.name, value: conversions > 0 ? Math.round((c.actual_spend / conversions) * 100) / 100 : 0 };
  });

  const spendTrend = bucketSpendByMonth(campaignRows, 6);

  const leadFunnel = LEAD_STAGES.map((s) => ({
    label: s.label,
    value: leadRows.filter((l) => l.stage === s.value).length,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Campaign Analytics</h1>
        <p className="text-sm text-[#707975] mt-1">Leads, conversions, spend, and revenue across every marketing channel.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarListChart title="Leads by Source" data={leadsBySource} />
        <BarListChart title="Conversion by Source (%)" data={conversionBySource} />
        <BarListChart title="Campaign Performance (Leads)" data={campaignPerformance} />
        <BarListChart title="Attributed Revenue by Campaign" data={attributedRevenueByCampaign} />
        <BarListChart title="Cost Per Lead by Campaign" data={costPerLeadByCampaign} />
        <BarListChart title="Cost Per Acquisition by Campaign" data={costPerAcquisitionByCampaign} />
        <TrendLineChart title="Campaign Spend Trend (6 Months)" data={spendTrend} />
        <BarListChart title="Lead Funnel" data={leadFunnel} />
      </div>
    </div>
  );
}
