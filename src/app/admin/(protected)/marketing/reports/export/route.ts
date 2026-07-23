import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { getCampaignAttributionMap, getReferralAttributionMap } from '@/lib/dashboard/marketing-adapters';
import { emailRates, landingPageConversionRate } from '@/data/marketing';

const VALID_TYPES = new Set([
  'campaign-performance', 'lead-source', 'content-calendar', 'social-media',
  'email-campaigns', 'referrals-partnerships', 'landing-pages',
]);

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvEscape).join(',') + '\r\n';
}

export async function GET(request: Request) {
  try {
    await requirePermission('marketing.reports.export');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') ?? '';
  if (!VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
  }

  const supabase = await createClient();
  let csv = '';

  if (type === 'campaign-performance') {
    const [{ data: campaigns }, attribution] = await Promise.all([
      supabase.from('marketing_campaigns').select('id, name, type, status, budget, actual_spend'),
      getCampaignAttributionMap(supabase),
    ]);
    csv += csvRow(['Campaign Performance Report']);
    csv += '\r\n';
    csv += csvRow(['Name', 'Type', 'Status', 'Budget', 'Actual Spend', 'Leads', 'Conversions', 'Attributed Revenue']);
    for (const c of campaigns ?? []) {
      const a = attribution.get(c.id);
      csv += csvRow([c.name, c.type ?? '', c.status, c.budget, c.actual_spend, a?.leadsCount ?? 0, a?.conversionsCount ?? 0, a?.attributedRevenue ?? 0]);
    }
  }

  if (type === 'lead-source') {
    const { data: leads } = await supabase.from('website_leads').select('full_name, business_name, lead_source, is_mql, is_sql, stage, created_at');
    csv += csvRow(['Lead Source Report']);
    csv += '\r\n';
    csv += csvRow(['Contact', 'Business', 'Source', 'MQL', 'SQL', 'Stage', 'Created']);
    for (const l of leads ?? []) {
      csv += csvRow([l.full_name, l.business_name, l.lead_source ?? '', l.is_mql ? 'Yes' : 'No', l.is_sql ? 'Yes' : 'No', l.stage, l.created_at]);
    }
  }

  if (type === 'content-calendar') {
    const { data: items } = await supabase.from('content_calendar_items').select('title, content_type, channel, status, approval_status, planned_date, performance_notes');
    csv += csvRow(['Content Calendar Report']);
    csv += '\r\n';
    csv += csvRow(['Title', 'Type', 'Channel', 'Status', 'Approval', 'Planned Date', 'Performance Notes']);
    for (const i of items ?? []) {
      csv += csvRow([i.title, i.content_type, i.channel ?? '', i.status, i.approval_status, i.planned_date ?? '', i.performance_notes ?? '']);
    }
  }

  if (type === 'social-media') {
    const { data: posts } = await supabase.from('social_media_posts').select('platform, posted_date, reach, engagement, clicks, leads, conversions');
    csv += csvRow(['Social Media Report']);
    csv += '\r\n';
    csv += csvRow(['Platform', 'Posted Date', 'Reach', 'Engagement', 'Clicks', 'Leads', 'Conversions']);
    for (const p of posts ?? []) {
      csv += csvRow([p.platform, p.posted_date ?? '', p.reach, p.engagement, p.clicks, p.leads, p.conversions]);
    }
  }

  if (type === 'email-campaigns') {
    const { data: campaigns } = await supabase.from('email_campaigns').select('*');
    csv += csvRow(['Email Campaigns Report']);
    csv += '\r\n';
    csv += csvRow(['Subject', 'Sent', 'Delivery Rate (%)', 'Open Rate (%)', 'Click Rate (%)', 'Leads', 'Conversions', 'Unsubscribes', 'Status']);
    for (const c of campaigns ?? []) {
      const rates = emailRates(c);
      csv += csvRow([c.subject, c.sent_count, rates.deliveryRate, rates.openRate, rates.clickRate, c.leads, c.conversions, c.unsubscribes, c.status]);
    }
  }

  if (type === 'referrals-partnerships') {
    const [{ data: rows }, attribution] = await Promise.all([
      supabase.from('referral_partnership_campaigns').select('id, type, referrer_or_partner_name, status'),
      getReferralAttributionMap(supabase),
    ]);
    csv += csvRow(['Referrals & Partnerships Report']);
    csv += '\r\n';
    csv += csvRow(['Type', 'Name', 'Status', 'Leads', 'Conversions', 'Attributed Revenue']);
    for (const r of rows ?? []) {
      const a = attribution.get(r.id);
      csv += csvRow([r.type, r.referrer_or_partner_name, r.status, a?.leadsCount ?? 0, a?.conversionsCount ?? 0, a?.attributedRevenue ?? 0]);
    }
  }

  if (type === 'landing-pages') {
    const { data: pages } = await supabase.from('landing_pages').select('page_name, url_reference, visits, form_submissions, status');
    csv += csvRow(['Landing Pages Report']);
    csv += '\r\n';
    csv += csvRow(['Page Name', 'URL', 'Visits', 'Submissions', 'Conversion Rate (%)', 'Status']);
    for (const p of pages ?? []) {
      csv += csvRow([p.page_name, p.url_reference ?? '', p.visits, p.form_submissions, landingPageConversionRate(p), p.status]);
    }
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bizlink-${type}-report.csv"`,
    },
  });
}
