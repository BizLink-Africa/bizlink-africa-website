import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import CreateContentItemForm from '@/components/admin/marketing/CreateContentItemForm';
import ContentItemRow from '@/components/admin/marketing/ContentItemRow';
import type { ContentCalendarItem } from '@/data/marketing';

export const dynamic = 'force-dynamic';

export default async function ContentCalendarPage() {
  let canManage = true;
  try {
    await requirePermission('content_calendar.view');
  } catch {
    return <AccessDenied requiredPermission="content_calendar.view" />;
  }
  try {
    await requirePermission('content_calendar.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data: items, error }, { data: campaigns }, { data: staffRows }] = await Promise.all([
    supabase.from('content_calendar_items').select('*').order('planned_date', { ascending: true, nullsFirst: false }),
    supabase.from('marketing_campaigns').select('id, name').order('name'),
    supabase.from('staff_profiles').select('id, full_name').eq('is_active', true).order('full_name'),
  ]);

  const campaignNameById = new Map((campaigns ?? []).map((c) => [c.id, c.name]));
  const staffNameById = new Map((staffRows ?? []).map((s) => [s.id, s.full_name]));
  const rows = (items ?? []) as ContentCalendarItem[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Content Calendar</h1>
          <p className="text-sm text-[#707975] mt-1">{rows.length} content item{rows.length === 1 ? '' : 's'}</p>
        </div>
        {canManage && <CreateContentItemForm campaigns={campaigns ?? []} staff={staffRows ?? []} />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load content calendar: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Planned Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Approval</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <ContentItemRow
                key={item.id}
                item={item}
                ownerName={item.owner_user_id ? staffNameById.get(item.owner_user_id) ?? '—' : '—'}
                campaignName={item.campaign_id ? campaignNameById.get(item.campaign_id) ?? '—' : '—'}
                readOnly={!canManage}
              />
            ))}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-[#707975]">No content items yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
