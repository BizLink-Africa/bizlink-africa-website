import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import SecuritySeverityBadge from '@/components/admin/compliance/SecuritySeverityBadge';
import LogSecurityEventForm from '@/components/admin/compliance/LogSecurityEventForm';
import ResolveSecurityEventButton from '@/components/admin/compliance/ResolveSecurityEventButton';
import { SECURITY_EVENT_TYPES, SECURITY_EVENT_STATUSES, labelFor } from '@/data/compliance';
import { maskSecrets } from '@/lib/security/mask';

export const dynamic = 'force-dynamic';

export default async function SecurityEventsPage() {
  let hasManagePermission = true;
  try {
    await requirePermission('security.view');
  } catch {
    return <AccessDenied requiredPermission="security.view" />;
  }
  try {
    await requirePermission('security.manage');
  } catch {
    hasManagePermission = false;
  }

  const supabase = await createClient();
  const { data: events, error } = await supabase.from('security_events').select('*').order('created_at', { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Security Events</h1>
          <p className="text-sm text-[#707975] mt-1">{events?.length ?? 0} event{(events?.length ?? 0) === 1 ? '' : 's'}</p>
        </div>
        {hasManagePermission && <LogSecurityEventForm />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load security events: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Result</th>
              <th className="px-4 py-3">Investigation Status</th>
              {hasManagePermission && <th className="px-4 py-3">Action</th>}
            </tr>
          </thead>
          <tbody>
            {(events ?? []).map((e) => (
              <tr key={e.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#00342b]">{labelFor(SECURITY_EVENT_TYPES, e.event_type)}</td>
                <td className="px-4 py-3 text-[#3f4945]">{e.actor ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945] font-mono">{e.ip_address ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{e.device ?? '—'}</td>
                <td className="px-4 py-3"><SecuritySeverityBadge severity={e.severity} /></td>
                <td className="px-4 py-3 text-xs text-[#3f4945] max-w-[220px] break-words">{maskSecrets(e.description)}</td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">{new Date(e.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{e.result ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{labelFor(SECURITY_EVENT_STATUSES, e.status)}</td>
                {hasManagePermission && (
                  <td className="px-4 py-3">
                    <ResolveSecurityEventButton id={e.id} status={e.status} />
                  </td>
                )}
              </tr>
            ))}
            {(events ?? []).length === 0 && !error && (
              <tr>
                <td colSpan={hasManagePermission ? 9 : 8} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No security events logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
