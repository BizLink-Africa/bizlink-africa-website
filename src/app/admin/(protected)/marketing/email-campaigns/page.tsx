import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import CreateEmailCampaignForm from '@/components/admin/marketing/CreateEmailCampaignForm';
import { emailRates, EMAIL_CAMPAIGN_STATUSES, labelFor, type EmailCampaign } from '@/data/marketing';

export const dynamic = 'force-dynamic';

export default async function EmailCampaignsPage() {
  let canManage = true;
  try {
    await requirePermission('email_campaigns.view');
  } catch {
    return <AccessDenied requiredPermission="email_campaigns.view" />;
  }
  try {
    await requirePermission('email_campaigns.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data: campaigns, error }, { data: marketingCampaigns }] = await Promise.all([
    supabase.from('email_campaigns').select('*').order('created_at', { ascending: false }),
    supabase.from('marketing_campaigns').select('id, name').order('name'),
  ]);

  const campaignNameById = new Map((marketingCampaigns ?? []).map((c) => [c.id, c.name]));
  const rows = (campaigns ?? []) as EmailCampaign[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Email Campaigns</h1>
          <p className="text-sm text-[#707975] mt-1">{rows.length} email campaign{rows.length === 1 ? '' : 's'}</p>
        </div>
        {canManage && <CreateEmailCampaignForm campaigns={marketingCampaigns ?? []} />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load email campaigns: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Sent</th>
              <th className="px-4 py-3">Delivery Rate</th>
              <th className="px-4 py-3">Open Rate</th>
              <th className="px-4 py-3">Click Rate</th>
              <th className="px-4 py-3">Leads</th>
              <th className="px-4 py-3">Conversions</th>
              <th className="px-4 py-3">Unsubscribes</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const rates = emailRates(c);
              return (
                <tr key={c.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                  <td className="px-4 py-3 font-medium text-[#00342b]">{c.subject}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{c.campaign_id ? campaignNameById.get(c.campaign_id) ?? '—' : '—'}</td>
                  <td className="px-4 py-3 text-[#3f4945] tabular-nums">{c.sent_count}</td>
                  <td className="px-4 py-3 text-[#3f4945] tabular-nums">{rates.deliveryRate}%</td>
                  <td className="px-4 py-3 text-[#3f4945] tabular-nums">{rates.openRate}%</td>
                  <td className="px-4 py-3 text-[#3f4945] tabular-nums">{rates.clickRate}%</td>
                  <td className="px-4 py-3 text-[#3f4945] tabular-nums">{c.leads}</td>
                  <td className="px-4 py-3 text-[#3f4945] tabular-nums">{c.conversions}</td>
                  <td className="px-4 py-3 text-[#3f4945] tabular-nums">{c.unsubscribes}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{labelFor(EMAIL_CAMPAIGN_STATUSES, c.status)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-[#707975]">No email campaigns yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
