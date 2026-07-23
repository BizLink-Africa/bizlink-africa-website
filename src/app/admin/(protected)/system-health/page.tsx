import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { SYSTEM_COMPONENTS, type SystemHealthCheck } from '@/data/systemHealth';
import { labelFor } from '@/data/inquiries';
import SystemHealthCheckRow from '@/components/admin/SystemHealthCheckRow';

export const dynamic = 'force-dynamic';

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function SystemHealthPage() {
  let canManage = true;
  try {
    await requirePermission('system.health.view');
  } catch {
    return <AccessDenied requiredPermission="system.health.view" />;
  }
  try {
    await requirePermission('system.health.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('system_health_checks').select('*').order('component');
  const checks = (data ?? []) as SystemHealthCheck[];
  const latestCheck = checks.reduce<string | null>((latest, c) => (!latest || c.checked_at > latest ? c.checked_at : latest), null);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">System Health</h1>
        <p className="text-sm text-[#707975] mt-1">
          Manually tracked status per platform component. {latestCheck ? `Last updated ${formatDateTime(latestCheck)}.` : ''}
        </p>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load system health: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Component</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Error Rate</th>
              <th className="px-4 py-3">Detail</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => (
              <SystemHealthCheckRow
                key={check.id}
                id={check.id}
                label={labelFor(SYSTEM_COMPONENTS, check.component)}
                initialStatus={check.status}
                initialDetail={check.detail}
                errorRate={check.error_rate_percentage}
                canManage={canManage}
              />
            ))}
            {checks.length === 0 && !error && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No system health checks recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
