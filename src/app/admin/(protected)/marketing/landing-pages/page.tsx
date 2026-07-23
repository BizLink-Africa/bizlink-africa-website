import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import CreateLandingPageForm from '@/components/admin/marketing/CreateLandingPageForm';
import LandingPageStatusSelect from '@/components/admin/marketing/LandingPageStatusSelect';
import { landingPageConversionRate, type LandingPage } from '@/data/marketing';

export const dynamic = 'force-dynamic';

export default async function LandingPagesPage() {
  let canManage = true;
  try {
    await requirePermission('landing_pages.view');
  } catch {
    return <AccessDenied requiredPermission="landing_pages.view" />;
  }
  try {
    await requirePermission('landing_pages.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data: pages, error }, { data: campaigns }] = await Promise.all([
    supabase.from('landing_pages').select('*').order('created_at', { ascending: false }),
    supabase.from('marketing_campaigns').select('id, name').order('name'),
  ]);

  const campaignNameById = new Map((campaigns ?? []).map((c) => [c.id, c.name]));
  const rows = (pages ?? []) as LandingPage[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Landing Pages</h1>
          <p className="text-sm text-[#707975] mt-1">{rows.length} landing page{rows.length === 1 ? '' : 's'}</p>
        </div>
        {canManage && <CreateLandingPageForm campaigns={campaigns ?? []} />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load landing pages: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Page Name</th>
              <th className="px-4 py-3">URL</th>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Visits</th>
              <th className="px-4 py-3">Submissions</th>
              <th className="px-4 py-3">Conversion Rate</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">{p.page_name}</td>
                <td className="px-4 py-3 text-[#3f4945] text-xs">{p.url_reference ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{p.campaign_id ? campaignNameById.get(p.campaign_id) ?? '—' : '—'}</td>
                <td className="px-4 py-3 text-[#3f4945] tabular-nums">{p.visits}</td>
                <td className="px-4 py-3 text-[#3f4945] tabular-nums">{p.form_submissions}</td>
                <td className="px-4 py-3 text-[#3f4945] tabular-nums">{landingPageConversionRate(p)}%</td>
                <td className="px-4 py-3">
                  {canManage ? <LandingPageStatusSelect id={p.id} status={p.status} /> : p.status}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#707975]">No landing pages yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
