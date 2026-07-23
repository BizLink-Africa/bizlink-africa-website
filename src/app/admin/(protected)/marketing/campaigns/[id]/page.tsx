import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { getRecordActivity } from '@/lib/audit';
import CampaignStatusBadge from '@/components/admin/marketing/CampaignStatusBadge';
import CampaignDetailForm from '@/components/admin/marketing/CampaignDetailForm';
import ActivityTimeline from '@/components/admin/crm/ActivityTimeline';
import { getCampaignAttributionMap } from '@/lib/dashboard/marketing-adapters';
import { formatMoney } from '@/data/finance';
import { CAMPAIGN_STATUSES, CAMPAIGN_CHANNELS, CAMPAIGN_TYPES, labelFor, type Campaign } from '@/data/marketing';

export const dynamic = 'force-dynamic';

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  let canManage = true;
  try {
    await requirePermission('campaigns.view');
  } catch {
    return <AccessDenied requiredPermission="campaigns.view" />;
  }
  try {
    await requirePermission('campaigns.manage');
  } catch {
    canManage = false;
  }

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: campaign, error }, { data: staffRows }, attribution, activity, { data: contentItems }, { data: socialPosts }, { data: emailCampaigns }, { data: landingPages }] =
    await Promise.all([
      supabase.from('marketing_campaigns').select('*').eq('id', id).single(),
      supabase.from('staff_profiles').select('id, full_name').eq('is_active', true).order('full_name'),
      getCampaignAttributionMap(supabase),
      getRecordActivity(supabase, 'marketing_campaigns', id),
      supabase.from('content_calendar_items').select('id, title, status').eq('campaign_id', id),
      supabase.from('social_media_posts').select('id, platform, posted_date').eq('campaign_id', id),
      supabase.from('email_campaigns').select('id, subject, status').eq('campaign_id', id),
      supabase.from('landing_pages').select('id, page_name, status').eq('campaign_id', id),
    ]);

  if (error || !campaign) notFound();
  const c = campaign as Campaign;
  const staffNameById = new Map((staffRows ?? []).map((s) => [s.id, s.full_name]));
  const a = attribution.get(id) ?? { leadsCount: 0, conversionsCount: 0, attributedRevenue: 0 };
  const cpl = a.leadsCount > 0 ? c.actual_spend / a.leadsCount : null;
  const cpa = a.conversionsCount > 0 ? c.actual_spend / a.conversionsCount : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/marketing/campaigns" className="inline-flex items-center gap-1.5 text-sm text-[#00342b] hover:underline mb-3">
          <ArrowLeft size={14} /> Back to Campaigns
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-bold text-2xl text-[#00342b]">{c.name}</h1>
            <p className="text-sm text-[#707975] mt-1">
              {c.type ? labelFor(CAMPAIGN_TYPES, c.type) : 'No type set'} · {(c.channels?.length ? c.channels : [c.channel]).map((ch) => labelFor(CAMPAIGN_CHANNELS, ch)).join(', ')}
            </p>
          </div>
          <CampaignStatusBadge status={c.status} list={CAMPAIGN_STATUSES} />
        </div>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-4">Live Attribution</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
          <div><p className="text-xs text-[#707975] uppercase tracking-wider">Leads</p><p className="font-semibold text-[#00342b] text-lg">{a.leadsCount}</p></div>
          <div><p className="text-xs text-[#707975] uppercase tracking-wider">Conversions</p><p className="font-semibold text-[#00342b] text-lg">{a.conversionsCount}</p></div>
          <div><p className="text-xs text-[#707975] uppercase tracking-wider">Revenue</p><p className="font-semibold text-[#1b7a3d] text-lg">{formatMoney(a.attributedRevenue, c.currency)}</p></div>
          <div><p className="text-xs text-[#707975] uppercase tracking-wider">Cost / Lead</p><p className="font-semibold text-[#00342b] text-lg">{cpl !== null ? formatMoney(cpl, c.currency) : '—'}</p></div>
          <div><p className="text-xs text-[#707975] uppercase tracking-wider">Cost / Acquisition</p><p className="font-semibold text-[#00342b] text-lg">{cpa !== null ? formatMoney(cpa, c.currency) : '—'}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {canManage ? (
            <CampaignDetailForm
              id={id}
              currency={c.currency}
              initialBudget={c.budget}
              initialActualSpend={c.actual_spend}
              initialOwnerUserId={c.owner_user_id ?? ''}
              initialTargetAudience={c.target_audience ?? ''}
              initialNotes={c.description ?? ''}
              staff={staffRows ?? []}
            />
          ) : (
            <div className="bg-white border border-[#bfc9c4] p-6 space-y-2 text-sm text-[#3f4945]">
              <p><span className="font-semibold text-[#707975]">Budget:</span> {formatMoney(c.budget, c.currency)}</p>
              <p><span className="font-semibold text-[#707975]">Actual Spend:</span> {formatMoney(c.actual_spend, c.currency)}</p>
              <p><span className="font-semibold text-[#707975]">Owner:</span> {c.owner_user_id ? staffNameById.get(c.owner_user_id) ?? '—' : '—'}</p>
              <p><span className="font-semibold text-[#707975]">Target Audience:</span> {c.target_audience ?? '—'}</p>
              <p><span className="font-semibold text-[#707975]">Notes:</span> {c.description ?? '—'}</p>
            </div>
          )}

          <div className="bg-white border border-[#bfc9c4] p-6">
            <h2 className="font-semibold text-[#00342b] mb-3">Linked Activity</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Content ({(contentItems ?? []).length})</p>
                {(contentItems ?? []).length === 0 ? <p className="text-[#707975]">None</p> : (
                  <ul className="space-y-1">{(contentItems ?? []).map((i) => <li key={i.id} className="text-[#3f4945]">{i.title} — {i.status}</li>)}</ul>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Social Posts ({(socialPosts ?? []).length})</p>
                {(socialPosts ?? []).length === 0 ? <p className="text-[#707975]">None</p> : (
                  <ul className="space-y-1">{(socialPosts ?? []).map((i) => <li key={i.id} className="text-[#3f4945]">{i.platform} — {i.posted_date ?? '—'}</li>)}</ul>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Email Campaigns ({(emailCampaigns ?? []).length})</p>
                {(emailCampaigns ?? []).length === 0 ? <p className="text-[#707975]">None</p> : (
                  <ul className="space-y-1">{(emailCampaigns ?? []).map((i) => <li key={i.id} className="text-[#3f4945]">{i.subject} — {i.status}</li>)}</ul>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Landing Pages ({(landingPages ?? []).length})</p>
                {(landingPages ?? []).length === 0 ? <p className="text-[#707975]">None</p> : (
                  <ul className="space-y-1">{(landingPages ?? []).map((i) => <li key={i.id} className="text-[#3f4945]">{i.page_name} — {i.status}</li>)}</ul>
                )}
              </div>
            </div>
          </div>
        </div>

        <ActivityTimeline entries={activity} />
      </div>
    </div>
  );
}
