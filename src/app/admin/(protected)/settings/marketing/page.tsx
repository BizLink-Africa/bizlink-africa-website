import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import InlineSelect from '@/components/admin/InlineSelect';
import MarketingSettingsForm from '@/components/admin/MarketingSettingsForm';
import { setCampaignCategoryActiveOption, setLeadSourceActiveOption } from './actions';

export const dynamic = 'force-dynamic';

const ACTIVE_OPTIONS = [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] as const;

interface Catalog {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export default async function MarketingSettingsPage() {
  let canManage = true;
  try {
    await requirePermission('marketing.settings.view');
  } catch {
    return <AccessDenied requiredPermission="marketing.settings.view" />;
  }
  try {
    await requirePermission('marketing.settings.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data: settings }, { data: categories }, { data: sources }] = await Promise.all([
    supabase.from('company_settings').select('marketing_default_channels, marketing_reporting_preference').eq('id', true).single(),
    supabase.from('marketing_campaign_categories').select('*').order('name'),
    supabase.from('marketing_lead_sources').select('*').order('name'),
  ]);

  const initial = {
    defaultChannels: settings?.marketing_default_channels ?? ['email', 'social_media'],
    reportingPreference: settings?.marketing_reporting_preference ?? 'monthly',
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Marketing Settings</h1>
        <p className="text-sm text-[#707975] mt-1">Campaign categories, lead sources, default channels, and reporting cadence.</p>
      </div>

      {canManage ? (
        <MarketingSettingsForm initial={initial} />
      ) : (
        <div className="bg-white border border-[#bfc9c4] p-6 space-y-2 text-sm text-[#3f4945]">
          <p><span className="font-semibold text-[#707975]">Default Channels:</span> {initial.defaultChannels.join(', ')}</p>
          <p><span className="font-semibold text-[#707975]">Reporting Preference:</span> {initial.reportingPreference}</p>
        </div>
      )}

      <div>
        <h2 className="font-semibold text-[#00342b] mb-2">Campaign Categories</h2>
        <div className="bg-white border border-[#bfc9c4] p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
                <th className="py-2">Name</th>
                <th className="py-2">Description</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {((categories ?? []) as Catalog[]).map((c) => (
                <tr key={c.id} className="border-b border-[#e5e5e5] last:border-0">
                  <td className="py-2 text-[#1b1c1c] font-medium">{c.name}</td>
                  <td className="py-2 text-[#707975] text-xs">{c.description ?? '—'}</td>
                  <td className="py-2">
                    {canManage ? (
                      <InlineSelect value={String(c.is_active)} options={ACTIVE_OPTIONS} onSave={setCampaignCategoryActiveOption.bind(null, c.id)} />
                    ) : (
                      <span className="text-xs text-[#3f4945]">{c.is_active ? 'Active' : 'Inactive'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-[#00342b] mb-2">Lead Sources</h2>
        <div className="bg-white border border-[#bfc9c4] p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
                <th className="py-2">Name</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {((sources ?? []) as Catalog[]).map((s) => (
                <tr key={s.id} className="border-b border-[#e5e5e5] last:border-0">
                  <td className="py-2 text-[#1b1c1c] font-medium">{s.name}</td>
                  <td className="py-2">
                    {canManage ? (
                      <InlineSelect value={String(s.is_active)} options={ACTIVE_OPTIONS} onSave={setLeadSourceActiveOption.bind(null, s.id)} />
                    ) : (
                      <span className="text-xs text-[#3f4945]">{s.is_active ? 'Active' : 'Inactive'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
