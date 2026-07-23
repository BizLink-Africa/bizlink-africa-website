import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import type { LoginEvent } from '@/data/logins';

export const dynamic = 'force-dynamic';

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function LoginMonitoringPage() {
  try {
    await requirePermission('logins.view');
  } catch {
    return <AccessDenied requiredPermission="logins.view" />;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('login_events').select('*').order('occurred_at', { ascending: false }).limit(200);
  const logins = (data ?? []) as LoginEvent[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Login Monitoring</h1>
        <p className="text-sm text-[#707975] mt-1">
          Most recent 200 login attempts against the admin dashboard — real data, recorded on every sign-in attempt.
        </p>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load login activity: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Result</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">User Agent</th>
              <th className="px-4 py-3">Failure Reason</th>
            </tr>
          </thead>
          <tbody>
            {logins.map((l) => (
              <tr key={l.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">{formatDateTime(l.occurred_at)}</td>
                <td className="px-4 py-3 text-[#3f4945]">{l.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${l.success ? 'text-[#1b7a3d]' : 'text-[#8a1f1f]'}`}>{l.success ? 'Success' : 'Failed'}</span>
                </td>
                <td className="px-4 py-3 text-xs text-[#3f4945] font-mono">{l.ip_address ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#707975] max-w-[240px] break-words">{l.user_agent ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-red-700">{l.failure_reason ?? '—'}</td>
              </tr>
            ))}
            {logins.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No login activity recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
