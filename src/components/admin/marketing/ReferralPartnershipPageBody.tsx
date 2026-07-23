import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import CreateReferralPartnershipForm from '@/components/admin/marketing/CreateReferralPartnershipForm';
import ReferralPartnershipStatusSelect from '@/components/admin/marketing/ReferralPartnershipStatusSelect';
import { getReferralAttributionMap } from '@/lib/dashboard/marketing-adapters';
import { formatMoney } from '@/data/finance';
import type { ReferralPartnership, ReferralPartnershipType } from '@/data/marketing';

// Shared by both the Referral Campaigns and Partnership Campaigns routes —
// same underlying referral_partnership_campaigns table, filtered by
// `type`. See app/admin/(protected)/marketing/referrals/actions.ts.
export default async function ReferralPartnershipPageBody({ type, title }: { type: ReferralPartnershipType; title: string }) {
  let canManage = true;
  try {
    await requirePermission('referrals.view');
  } catch {
    return <AccessDenied requiredPermission="referrals.view" />;
  }
  try {
    await requirePermission('referrals.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data: rows, error }, { data: campaigns }, { data: settings }, attribution] = await Promise.all([
    supabase.from('referral_partnership_campaigns').select('*').eq('type', type).order('created_at', { ascending: false }),
    supabase.from('marketing_campaigns').select('id, name').order('name'),
    supabase.from('company_settings').select('default_currency').eq('id', true).single(),
    getReferralAttributionMap(supabase),
  ]);

  const campaignNameById = new Map((campaigns ?? []).map((c) => [c.id, c.name]));
  const currency = settings?.default_currency ?? 'TZS';
  const items = (rows ?? []) as ReferralPartnership[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">{title}</h1>
          <p className="text-sm text-[#707975] mt-1">{items.length} {title.toLowerCase()}</p>
        </div>
        {canManage && <CreateReferralPartnershipForm type={type} label={type === 'referral' ? 'Referrer' : 'Partner'} campaigns={campaigns ?? []} />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load {title.toLowerCase()}: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">{type === 'referral' ? 'Referrer' : 'Partner'}</th>
              <th className="px-4 py-3">Related Campaign</th>
              <th className="px-4 py-3">Leads</th>
              <th className="px-4 py-3">Conversions</th>
              <th className="px-4 py-3">Attributed Revenue</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const a = attribution.get(item.id);
              return (
                <tr key={item.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                  <td className="px-4 py-3 font-medium text-[#1b1c1c]">{item.referrer_or_partner_name}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{item.campaign_id ? campaignNameById.get(item.campaign_id) ?? '—' : '—'}</td>
                  <td className="px-4 py-3 text-[#3f4945] tabular-nums">{a?.leadsCount ?? 0}</td>
                  <td className="px-4 py-3 text-[#3f4945] tabular-nums">{a?.conversionsCount ?? 0}</td>
                  <td className="px-4 py-3 text-[#3f4945] tabular-nums">{formatMoney(a?.attributedRevenue ?? 0, currency)}</td>
                  <td className="px-4 py-3">
                    {canManage ? <ReferralPartnershipStatusSelect id={item.id} status={item.status} /> : item.status}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#707975]">None yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
