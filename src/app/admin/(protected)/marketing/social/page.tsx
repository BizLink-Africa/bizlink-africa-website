import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import CreateSocialMediaPostForm from '@/components/admin/marketing/CreateSocialMediaPostForm';
import { SOCIAL_PLATFORMS, labelFor, type SocialMediaPost } from '@/data/marketing';

export const dynamic = 'force-dynamic';

export default async function SocialMediaPage() {
  let canManage = true;
  try {
    await requirePermission('social_media.view');
  } catch {
    return <AccessDenied requiredPermission="social_media.view" />;
  }
  try {
    await requirePermission('social_media.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data: posts, error }, { data: campaigns }] = await Promise.all([
    supabase.from('social_media_posts').select('*').order('posted_date', { ascending: false, nullsFirst: false }),
    supabase.from('marketing_campaigns').select('id, name').order('name'),
  ]);

  const campaignNameById = new Map((campaigns ?? []).map((c) => [c.id, c.name]));
  const rows = (posts ?? []) as SocialMediaPost[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Social Media</h1>
          <p className="text-sm text-[#707975] mt-1">{rows.length} post{rows.length === 1 ? '' : 's'} logged</p>
        </div>
        {canManage && <CreateSocialMediaPostForm campaigns={campaigns ?? []} />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load social media posts: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Posted</th>
              <th className="px-4 py-3">Reach</th>
              <th className="px-4 py-3">Engagement</th>
              <th className="px-4 py-3">Clicks</th>
              <th className="px-4 py-3">Leads</th>
              <th className="px-4 py-3">Conversions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#00342b]">{labelFor(SOCIAL_PLATFORMS, p.platform)}</td>
                <td className="px-4 py-3 text-[#3f4945]">{p.campaign_id ? campaignNameById.get(p.campaign_id) ?? '—' : '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{p.posted_date ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945] tabular-nums">{p.reach}</td>
                <td className="px-4 py-3 text-[#3f4945] tabular-nums">{p.engagement}</td>
                <td className="px-4 py-3 text-[#3f4945] tabular-nums">{p.clicks}</td>
                <td className="px-4 py-3 text-[#3f4945] tabular-nums">{p.leads}</td>
                <td className="px-4 py-3 text-[#3f4945] tabular-nums">{p.conversions}</td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#707975]">No posts logged yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
