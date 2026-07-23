import Link from 'next/link';
import { requirePermission, getUserPermissions } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import NotificationReadButton from '@/components/admin/notifications/NotificationReadButton';
import MarkAllReadButton from '@/components/admin/notifications/MarkAllReadButton';
import NotificationBroadcastForm from '@/components/admin/notifications/NotificationBroadcastForm';

export const dynamic = 'force-dynamic';

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  priority: string;
  department: string | null;
  related_module: string | null;
  related_record_id: string | null;
  created_by: string;
  created_at: string;
}

interface SearchParams {
  department?: string;
  priority?: string;
  state?: string;
}

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-[#eeeeee] text-[#3f4945]',
  normal: 'bg-[#e0f2ee] text-[#00342b]',
  high: 'bg-[#fdecc8] text-[#8a5a00]',
  urgent: 'bg-[#fbdada] text-red-700',
};

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  let user;
  try {
    user = await requirePermission('notifications.view');
  } catch {
    return <AccessDenied requiredPermission="notifications.view" />;
  }

  const params = await searchParams;
  const permissions = await getUserPermissions();
  const canBroadcast = permissions.has('notifications.manage');

  const supabase = await createClient();
  const { data: staffRow } = await supabase.from('staff_profiles').select('id, department').eq('user_id', user.id).maybeSingle();

  // RLS only gates on notifications.view — the "you only see broadcasts +
  // your own department" narrowing happens here, in the query, because
  // has_permission() has no way to compare against the caller's own
  // department (see the admin_notifications migration).
  let query = supabase.from('admin_notifications').select('*').order('created_at', { ascending: false });
  query = staffRow?.department
    ? query.or(`department.is.null,department.eq.${staffRow.department}`)
    : query.is('department', null);

  const [{ data: notifications, error }, { data: readRows }] = await Promise.all([
    query,
    staffRow ? supabase.from('admin_notification_reads').select('notification_id').eq('staff_id', staffRow.id) : Promise.resolve({ data: [] as { notification_id: string }[] }),
  ]);

  const allNotifications = (notifications ?? []) as NotificationRow[];
  const readIds = new Set((readRows ?? []).map((r) => r.notification_id));

  const filtered = allNotifications.filter((n) => {
    if (params.department === 'general' && n.department !== null) return false;
    if (params.department && params.department !== 'general' && n.department !== params.department) return false;
    if (params.priority && n.priority !== params.priority) return false;
    if (params.state === 'unread' && readIds.has(n.id)) return false;
    if (params.state === 'read' && !readIds.has(n.id)) return false;
    return true;
  });

  const unreadIds = allNotifications.filter((n) => !readIds.has(n.id)).map((n) => n.id);
  const departmentOptions = [...new Set(allNotifications.map((n) => n.department).filter((d): d is string => Boolean(d)))].sort();

  const selectClass = 'border border-[#bfc9c4] px-2 py-2 text-xs focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';
  const hasFilters = Boolean(params.department || params.priority || params.state);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Notifications</h1>
          <p className="text-sm text-[#707975] mt-1">
            {unreadIds.length} unread of {allNotifications.length}. Shows broadcasts to all staff plus anything
            targeted at your own department{staffRow?.department ? ` (${staffRow.department})` : ''}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MarkAllReadButton unreadIds={unreadIds} />
          {canBroadcast && <NotificationBroadcastForm />}
        </div>
      </div>

      <form method="GET" className="mb-4 bg-white border border-[#bfc9c4] p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className={labelClass} htmlFor="state">Status</label>
          <select id="state" name="state" defaultValue={params.state ?? ''} className={selectClass}>
            <option value="">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="priority">Priority</label>
          <select id="priority" name="priority" defaultValue={params.priority ?? ''} className={selectClass}>
            <option value="">All priorities</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="department">Department</label>
          <select id="department" name="department" defaultValue={params.department ?? ''} className={selectClass}>
            <option value="">All</option>
            <option value="general">General (all staff)</option>
            {departmentOptions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <button type="submit" className="bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors">
          Apply
        </button>
        {hasFilters && (
          <Link href="/admin/notifications" className="text-sm text-[#707975] hover:text-[#00342b] px-2 py-2">
            Clear
          </Link>
        )}
      </form>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load notifications: {error.message}
        </p>
      )}

      <div className="space-y-3">
        {filtered.map((n) => {
          const isRead = readIds.has(n.id);
          return (
            <div key={n.id} className={`bg-white border p-4 flex items-start justify-between gap-4 flex-wrap ${isRead ? 'border-[#bfc9c4]' : 'border-[#00342b]'}`}>
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {!isRead && <span className="w-2 h-2 rounded-full bg-[#00342b]" aria-label="Unread" />}
                  <h3 className="font-semibold text-[#1b1c1c]">{n.title}</h3>
                  <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full uppercase ${PRIORITY_STYLES[n.priority] ?? PRIORITY_STYLES.normal}`}>
                    {n.priority}
                  </span>
                  <span className="text-[10px] text-[#707975] uppercase">{n.department ?? 'All staff'}</span>
                </div>
                <p className="text-sm text-[#3f4945]">{n.message}</p>
                <p className="text-xs text-[#707975] mt-2">
                  {n.created_by} · {new Date(n.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                  {n.related_module && (
                    <> · Related: <span className="font-mono">{n.related_module}{n.related_record_id ? ` #${n.related_record_id}` : ''}</span></>
                  )}
                </p>
              </div>
              {!isRead && <NotificationReadButton id={n.id} />}
            </div>
          );
        })}
        {filtered.length === 0 && !error && (
          <div className="bg-white border border-[#bfc9c4] px-4 py-10 text-center text-sm text-[#707975]">
            No notifications match these filters.
          </div>
        )}
      </div>
    </div>
  );
}
