import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import NotificationSettingsForm from '@/components/admin/NotificationSettingsForm';
import type { NotificationSettingsInput } from './actions';

export const dynamic = 'force-dynamic';

interface NotificationSettingsRow {
  notifications_broadcast_enabled: boolean;
  notifications_default_priority: string;
}

export default async function NotificationSettingsPage() {
  let canManage = true;
  try {
    await requirePermission('notification.settings.view');
  } catch {
    return <AccessDenied requiredPermission="notification.settings.view" />;
  }
  try {
    await requirePermission('notification.settings.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('company_settings')
    .select('notifications_broadcast_enabled, notifications_default_priority')
    .eq('id', true)
    .single();

  const settings = data as NotificationSettingsRow | null;
  const initial: NotificationSettingsInput = {
    broadcastEnabled: settings?.notifications_broadcast_enabled ?? true,
    defaultPriority: settings?.notifications_default_priority ?? 'normal',
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Notification Settings</h1>
        <p className="text-sm text-[#707975] mt-1">
          Configuration for the in-app notification center. Manage individual messages on{' '}
          <Link href="/admin/notifications" className="underline hover:text-[#00342b]">Notifications</Link>.
        </p>
      </div>

      {canManage ? (
        <NotificationSettingsForm initial={initial} />
      ) : (
        <div className="bg-white border border-[#bfc9c4] p-6 space-y-2 text-sm text-[#3f4945]">
          <p><span className="font-semibold text-[#707975]">Broadcasting Enabled:</span> {initial.broadcastEnabled ? 'Yes' : 'No'}</p>
          <p><span className="font-semibold text-[#707975]">Default Priority:</span> {initial.defaultPriority}</p>
        </div>
      )}
    </div>
  );
}
