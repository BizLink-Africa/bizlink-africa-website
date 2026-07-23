import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import type { DatabaseHealthMetric } from '@/data/databaseHealth';
import AddDatabaseHealthMetricForm from '@/components/admin/AddDatabaseHealthMetricForm';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  operational: 'text-[#1b7a3d]',
  degraded: 'text-[#8a5a00]',
  down: 'text-[#8a1f1f]',
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function DatabaseHealthPage() {
  let canManage = true;
  try {
    await requirePermission('database.health.view');
  } catch {
    return <AccessDenied requiredPermission="database.health.view" />;
  }
  try {
    await requirePermission('database.health.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('database_health_metrics').select('*').order('recorded_at', { ascending: false }).limit(100);
  const metrics = (data ?? []) as DatabaseHealthMetric[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Database Health</h1>
          <p className="text-sm text-[#707975] mt-1">Manually recorded database metrics — most recent 100.</p>
        </div>
        {canManage && <AddDatabaseHealthMetricForm />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load database health metrics: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Metric</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Recorded</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">{m.metric_name}</td>
                <td className="px-4 py-3 text-[#3f4945]">{m.value != null ? `${m.value}${m.unit ? ` ${m.unit}` : ''}` : '—'}</td>
                <td className={`px-4 py-3 text-xs font-medium ${STATUS_COLORS[m.status] ?? ''}`}>{m.status}</td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">{formatDateTime(m.recorded_at)}</td>
              </tr>
            ))}
            {metrics.length === 0 && !error && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No database health metrics recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
