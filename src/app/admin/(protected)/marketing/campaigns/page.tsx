import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import InlineSelect from '@/components/admin/InlineSelect';
import CampaignStatusBadge from '@/components/admin/marketing/CampaignStatusBadge';
import CreateCampaignForm from '@/components/admin/marketing/CreateCampaignForm';
import { getCampaignAttributionMap } from '@/lib/dashboard/marketing-adapters';
import { CAMPAIGN_STATUSES, CAMPAIGN_CHANNELS, CAMPAIGN_TYPES, labelFor, type Campaign } from '@/data/marketing';
import { formatMoney } from '@/data/finance';
import { updateCampaignStatus } from './actions';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  let hasManagePermission = true;
  try {
    await requirePermission('campaigns.view');
  } catch {
    return <AccessDenied requiredPermission="campaigns.view" />;
  }
  try {
    await requirePermission('campaigns.manage');
  } catch {
    hasManagePermission = false;
  }

  const supabase = await createClient();
  const [{ data: campaigns, error }, { data: settings }, { data: staffRows }, attribution] = await Promise.all([
    supabase.from('marketing_campaigns').select('*').order('created_at', { ascending: false }),
    supabase.from('company_settings').select('default_currency').eq('id', true).single(),
    supabase.from('staff_profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    getCampaignAttributionMap(supabase),
  ]);

  const staffNameById = new Map((staffRows ?? []).map((s) => [s.id, s.full_name]));
  const rows = (campaigns ?? []) as Campaign[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Campaigns</h1>
          <p className="text-sm text-[#707975] mt-1">{rows.length} campaign{rows.length === 1 ? '' : 's'}</p>
        </div>
        {hasManagePermission && <CreateCampaignForm currency={settings?.default_currency ?? 'TZS'} staff={staffRows ?? []} />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load campaigns: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Channels</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Budget / Spend</th>
              <th className="px-4 py-3">Leads · Conv. · Revenue</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const a = attribution.get(c.id);
              return (
                <tr key={c.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                  <td className="px-4 py-3 font-medium text-[#00342b]">
                    <Link href={`/admin/marketing/campaigns/${c.id}`} className="hover:underline">{c.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-[#3f4945]">{c.type ? labelFor(CAMPAIGN_TYPES, c.type) : '—'}</td>
                  <td className="px-4 py-3 text-[#3f4945] text-xs">
                    {(c.channels && c.channels.length > 0 ? c.channels : [c.channel]).map((ch) => labelFor(CAMPAIGN_CHANNELS, ch)).join(', ')}
                  </td>
                  <td className="px-4 py-3 text-[#3f4945]">{c.owner_user_id ? staffNameById.get(c.owner_user_id) ?? '—' : '—'}</td>
                  <td className="px-4 py-3 text-[#3f4945] tabular-nums text-xs">
                    {formatMoney(c.budget, c.currency)} / {formatMoney(c.actual_spend, c.currency)}
                  </td>
                  <td className="px-4 py-3 text-[#3f4945] tabular-nums text-xs">
                    {a?.leadsCount ?? 0} · {a?.conversionsCount ?? 0} · {formatMoney(a?.attributedRevenue ?? 0, c.currency)}
                  </td>
                  <td className="px-4 py-3 text-[#3f4945] text-xs">{c.start_date ?? '—'} → {c.end_date ?? '—'}</td>
                  <td className="px-4 py-3">
                    {hasManagePermission ? (
                      <InlineSelect value={c.status} options={CAMPAIGN_STATUSES} onSave={updateCampaignStatus.bind(null, c.id)} />
                    ) : (
                      <CampaignStatusBadge status={c.status} list={CAMPAIGN_STATUSES} />
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No campaigns yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
