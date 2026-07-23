import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import type { CampaignAttribution } from '@/data/marketing';

type Supabase = Awaited<ReturnType<typeof createClient>>;

const RECOGNIZED_REVENUE_STATUSES = ['issued', 'partially_paid', 'paid', 'overdue'];

interface LeadRow {
  id: string;
  campaign_id: string | null;
  referral_partner_id: string | null;
}

// Computes live attribution (leads/conversions/revenue) for every campaign
// (or every referral/partnership row) in one pass — 3 queries total
// regardless of how many campaigns exist, then joined in JS. This is the
// one place the campaign_id/referral_partner_id -> website_leads ->
// clients -> invoices chain is walked; every page that needs attribution
// (dashboard, campaign detail, analytics, reports) calls this instead of
// re-deriving it, so the numbers can never disagree with each other.
async function buildAttributionMaps(supabase: Supabase): Promise<{
  byCampaign: Map<string, CampaignAttribution>;
  byReferralPartner: Map<string, CampaignAttribution>;
  leads: LeadRow[];
}> {
  const { data: leads } = await supabase.from('website_leads').select('id, campaign_id, referral_partner_id');
  const leadRows = (leads ?? []) as LeadRow[];
  const leadIds = leadRows.map((l) => l.id);

  const { data: clients } = leadIds.length
    ? await supabase.from('clients').select('id, lead_id').in('lead_id', leadIds)
    : { data: [] as { id: string; lead_id: string | null }[] };
  const clientRows = (clients ?? []) as { id: string; lead_id: string | null }[];
  const clientIds = clientRows.map((c) => c.id);

  const { data: invoices } = clientIds.length
    ? await supabase.from('invoices').select('client_id, total, status').in('client_id', clientIds).in('status', RECOGNIZED_REVENUE_STATUSES)
    : { data: [] as { client_id: string | null; total: number }[] };

  const revenueByClientId = new Map<string, number>();
  for (const inv of invoices ?? []) {
    if (!inv.client_id) continue;
    revenueByClientId.set(inv.client_id, (revenueByClientId.get(inv.client_id) ?? 0) + inv.total);
  }

  const leadById = new Map(leadRows.map((l) => [l.id, l]));

  function emptyAttribution(): CampaignAttribution {
    return { leadsCount: 0, conversionsCount: 0, attributedRevenue: 0 };
  }

  function accumulate(map: Map<string, CampaignAttribution>, key: string | null, kind: 'lead' | 'conversion', revenue?: number) {
    if (!key) return;
    const existing = map.get(key) ?? emptyAttribution();
    if (kind === 'lead') existing.leadsCount += 1;
    else {
      existing.conversionsCount += 1;
      existing.attributedRevenue += revenue ?? 0;
    }
    map.set(key, existing);
  }

  const byCampaign = new Map<string, CampaignAttribution>();
  const byReferralPartner = new Map<string, CampaignAttribution>();

  for (const lead of leadRows) {
    accumulate(byCampaign, lead.campaign_id, 'lead');
    accumulate(byReferralPartner, lead.referral_partner_id, 'lead');
  }
  for (const client of clientRows) {
    if (!client.lead_id) continue;
    const lead = leadById.get(client.lead_id);
    if (!lead) continue;
    const revenue = revenueByClientId.get(client.id) ?? 0;
    accumulate(byCampaign, lead.campaign_id, 'conversion', revenue);
    accumulate(byReferralPartner, lead.referral_partner_id, 'conversion', revenue);
  }

  return { byCampaign, byReferralPartner, leads: leadRows };
}

export async function getCampaignAttributionMap(supabase: Supabase): Promise<Map<string, CampaignAttribution>> {
  return (await buildAttributionMaps(supabase)).byCampaign;
}

export async function getReferralAttributionMap(supabase: Supabase): Promise<Map<string, CampaignAttribution>> {
  return (await buildAttributionMaps(supabase)).byReferralPartner;
}

export interface MarketingOverview {
  currency: string;
  totalCampaignsCount: number;
  activeCampaignsCount: number;
  totalBudget: number;
  totalActualSpend: number;
  campaignAttributedRevenue: number;
  costPerLead: number | null;
  costPerAcquisition: number | null;
  totalLeadsCount: number;
  newLeadsCount: number;
  mqlCount: number;
  sqlCount: number;
  leadConversionRate: number;
  websiteLeadsCount: number;
  socialMediaLeadsCount: number;
  referralLeadsCount: number;
  partnershipLeadsCount: number;
  bestCampaign: { id: string; name: string; revenue: number } | null;
  bestChannel: { channel: string; revenue: number } | null;
  byChannel: { channel: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

export async function getMarketingOverview(supabase: Supabase): Promise<MarketingOverview | null> {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

  const [{ data: campaigns, error }, { data: leads, error: leadsError }, { data: settings }] = await Promise.all([
    supabase.from('marketing_campaigns').select('id, name, channel, channels, status, budget, actual_spend, currency'),
    supabase.from('website_leads').select('id, lead_source, is_mql, is_sql, created_at'),
    supabase.from('company_settings').select('default_currency').eq('id', true).single(),
  ]);

  if (error || !campaigns || leadsError || !leads) return null;

  const { byCampaign } = await buildAttributionMaps(supabase);

  const currency = settings?.default_currency ?? campaigns[0]?.currency ?? 'TZS';
  const activeCampaigns = campaigns.filter((c) => c.status === 'active');
  const totalBudget = campaigns.reduce((s, c) => s + (c.budget ?? 0), 0);
  const totalActualSpend = campaigns.reduce((s, c) => s + (c.actual_spend ?? 0), 0);

  const totalAttributedLeads = Array.from(byCampaign.values()).reduce((s, a) => s + a.leadsCount, 0);
  const totalAttributedConversions = Array.from(byCampaign.values()).reduce((s, a) => s + a.conversionsCount, 0);
  const campaignAttributedRevenue = Array.from(byCampaign.values()).reduce((s, a) => s + a.attributedRevenue, 0);

  const totalLeadsCount = leads.length;
  const newLeadsCount = leads.filter((l) => l.created_at >= monthStart).length;
  const mqlCount = leads.filter((l) => l.is_mql).length;
  const sqlCount = leads.filter((l) => l.is_sql).length;

  const bySourceCount = (source: string) => leads.filter((l) => l.lead_source === source).length;

  let bestCampaign: MarketingOverview['bestCampaign'] = null;
  for (const c of campaigns) {
    const attribution = byCampaign.get(c.id);
    if (!attribution || attribution.attributedRevenue <= 0) continue;
    if (!bestCampaign || attribution.attributedRevenue > bestCampaign.revenue) {
      bestCampaign = { id: c.id, name: c.name, revenue: attribution.attributedRevenue };
    }
  }

  // A campaign counts toward every channel it ran on — revenue isn't split
  // across channels within a multi-channel campaign, it's attributed in
  // full to each (an intentional simplification: there's no per-channel
  // click/lead data to split it more precisely).
  const channelRevenue = new Map<string, number>();
  const channelCounts = new Map<string, number>();
  for (const c of campaigns) {
    const attribution = byCampaign.get(c.id);
    const channelsUsed = c.channels && c.channels.length > 0 ? c.channels : [c.channel];
    for (const ch of channelsUsed) {
      channelCounts.set(ch, (channelCounts.get(ch) ?? 0) + 1);
      if (attribution) channelRevenue.set(ch, (channelRevenue.get(ch) ?? 0) + attribution.attributedRevenue);
    }
  }
  let bestChannel: MarketingOverview['bestChannel'] = null;
  for (const [channel, revenue] of channelRevenue.entries()) {
    if (revenue <= 0) continue;
    if (!bestChannel || revenue > bestChannel.revenue) bestChannel = { channel, revenue };
  }

  const byStatus = Object.values(
    campaigns.reduce<Record<string, { status: string; count: number }>>((acc, c) => {
      acc[c.status] = acc[c.status] ?? { status: c.status, count: 0 };
      acc[c.status].count += 1;
      return acc;
    }, {})
  );

  return {
    currency,
    totalCampaignsCount: campaigns.length,
    activeCampaignsCount: activeCampaigns.length,
    totalBudget,
    totalActualSpend,
    campaignAttributedRevenue,
    costPerLead: totalAttributedLeads > 0 ? Math.round((totalActualSpend / totalAttributedLeads) * 100) / 100 : null,
    costPerAcquisition: totalAttributedConversions > 0 ? Math.round((totalActualSpend / totalAttributedConversions) * 100) / 100 : null,
    totalLeadsCount,
    newLeadsCount,
    mqlCount,
    sqlCount,
    leadConversionRate: totalLeadsCount > 0 ? Math.round((totalAttributedConversions / totalLeadsCount) * 1000) / 10 : 0,
    websiteLeadsCount: bySourceCount('website'),
    socialMediaLeadsCount: bySourceCount('social_media'),
    referralLeadsCount: bySourceCount('referral'),
    partnershipLeadsCount: bySourceCount('partnership'),
    bestCampaign,
    bestChannel,
    byChannel: Array.from(channelCounts.entries()).map(([channel, count]) => ({ channel, count })),
    byStatus,
  };
}
