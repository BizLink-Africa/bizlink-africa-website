import { Download } from 'lucide-react';
import { requirePermission, getUserPermissions } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { getCrossDepartmentMetrics } from '@/lib/dashboard/governance-analytics-adapters';

export const dynamic = 'force-dynamic';

export default async function GovernanceAnalyticsPage() {
  try {
    await requirePermission('governance.analytics.view');
  } catch {
    return <AccessDenied requiredPermission="governance.analytics.view" />;
  }

  const permissions = await getUserPermissions();
  const canExport = permissions.has('governance.analytics.export');

  const supabase = await createClient();
  const metrics = await getCrossDepartmentMetrics(supabase);
  // Permission-aware: a metric only renders if the viewer holds that
  // specific department's own view permission — governance.analytics.view
  // only unlocks the page, not every department's numbers on it.
  const visibleMetrics = metrics.filter((m) => permissions.has(m.permission));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Reports & Analytics</h1>
          <p className="text-sm text-[#707975] mt-1">
            Cross-department snapshot. Only shows figures for departments you have view access to —{' '}
            {visibleMetrics.length} of {metrics.length} available to your role.
          </p>
        </div>
        {canExport && (
          <a
            href="/admin/governance/analytics/export"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors w-fit"
          >
            <Download size={14} /> Export CSV
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {visibleMetrics.map((m) => (
          <a key={m.key} href={m.href} className="bg-white border border-[#bfc9c4] p-4 hover:border-[#00342b] transition-colors">
            <div className="text-xs font-semibold text-[#707975] uppercase tracking-wider">{m.department}</div>
            <div className="text-2xl font-bold text-[#00342b] mt-1">{m.value}</div>
            <div className="text-xs text-[#3f4945] mt-0.5">{m.label}</div>
          </a>
        ))}
        {visibleMetrics.length === 0 && (
          <p className="col-span-full text-sm text-[#707975] py-10 text-center">
            No department view permissions granted to your role yet.
          </p>
        )}
      </div>
    </div>
  );
}
