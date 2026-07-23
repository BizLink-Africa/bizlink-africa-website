import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import type { UserSession } from '@/data/sessions';
import AddUserSessionForm from '@/components/admin/compliance/AddUserSessionForm';
import RevokeSessionButton from '@/components/admin/compliance/RevokeSessionButton';

export const dynamic = 'force-dynamic';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

interface SessionRow extends UserSession {
  staff_profiles: { full_name: string; email: string } | null;
}

export default async function SessionMonitoringPage() {
  let canManage = true;
  try {
    await requirePermission('sessions.view');
  } catch {
    return <AccessDenied requiredPermission="sessions.view" />;
  }
  try {
    await requirePermission('sessions.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data: staff }, { data, error }] = await Promise.all([
    supabase.from('staff_profiles').select('id, full_name, email').eq('is_active', true).order('full_name'),
    supabase.from('user_sessions').select('*, staff_profiles(full_name, email)').order('login_at', { ascending: false }).limit(200),
  ]);
  const sessions = (data ?? []) as unknown as SessionRow[];
  const activeCount = sessions.filter((s) => !s.revoked).length;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Session Monitoring</h1>
          <p className="text-sm text-[#707975] mt-1">
            {activeCount} active session{activeCount === 1 ? '' : 's'} — manually tracked, not a live Supabase Auth session mirror.
          </p>
        </div>
        {canManage && <AddUserSessionForm staff={staff ?? []} />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load sessions: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Staff Member</th>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">Login</th>
              <th className="px-4 py-3">Last Active</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">{s.staff_profiles?.full_name ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{s.device ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945] font-mono">{s.ip_address ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">{formatDateTime(s.login_at)}</td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">{formatDateTime(s.last_active_at)}</td>
                <td className="px-4 py-3">
                  {s.revoked ? (
                    <span className="text-xs font-medium text-[#8a1f1f]">Revoked{s.revoked_by ? ` by ${s.revoked_by}` : ''}</span>
                  ) : (
                    <span className="text-xs font-medium text-[#1b7a3d]">Active</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {canManage && !s.revoked && <RevokeSessionButton id={s.id} />}
                </td>
              </tr>
            ))}
            {sessions.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No sessions recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
