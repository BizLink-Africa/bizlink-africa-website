import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import NotificationBadge from '@/components/admin/NotificationBadge';

export const dynamic = 'force-dynamic';

interface NotificationRow {
  id: string;
  full_name: string;
  business_name: string;
  notification_status: string;
  notification_error: string | null;
  created_at: string;
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const recipient = process.env.BIZLINK_NOTIFICATION_EMAIL ?? 'ceo@bizlinkafrica.net';

  let query = supabase
    .from('website_leads')
    .select('id, full_name, business_name, notification_status, notification_error, created_at')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('notification_status', status);

  const { data, error } = await query;
  const notifications = (data ?? []) as NotificationRow[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-[Geist,sans-serif] font-bold text-2xl text-[#00342b]">Notifications</h1>
        </div>
        <div className="flex gap-1 bg-white border border-[#bfc9c4] p-1">
          {(['', 'sent', 'failed', 'pending'] as const).map((s) => (
            <Link
              key={s || 'all'}
              href={s ? `/admin/notifications?status=${s}` : '/admin/notifications'}
              className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                status === s || (!status && s === '') ? 'bg-[#00342b] text-white' : 'text-[#3f4945] hover:bg-[#f5f3f3]'
              }`}
            >
              {s || 'All'}
            </Link>
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load notifications: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Recipient</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Related Lead</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Error</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((n) => (
              <tr key={n.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-[#1b1c1c]">Inquiry Notification</td>
                <td className="px-4 py-3 text-[#3f4945]">{recipient}</td>
                <td className="px-4 py-3">
                  <NotificationBadge status={n.notification_status} />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/inquiries/${n.id}`} className="text-[#00342b] hover:underline">
                    {n.full_name} — {n.business_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">
                  {new Date(n.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                </td>
                <td className="px-4 py-3 text-xs text-red-700 max-w-[240px] break-words">{n.notification_error ?? '—'}</td>
              </tr>
            ))}
            {notifications.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No notifications yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
