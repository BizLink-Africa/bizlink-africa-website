import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { DEPLOYMENT_STATUSES, ROLLBACK_STATUSES, type Deployment } from '@/data/deployments';
import { labelFor } from '@/data/inquiries';
import AddDeploymentForm from '@/components/admin/AddDeploymentForm';
import InlineSelect from '@/components/admin/InlineSelect';
import RollbackDeploymentButton from '@/components/admin/RollbackDeploymentButton';
import { updateDeploymentStatus } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-[#707975]',
  in_progress: 'text-[#8a5a00]',
  success: 'text-[#1b7a3d]',
  failed: 'text-[#8a1f1f]',
  rolled_back: 'text-[#707975]',
};

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function DeploymentsPage() {
  let canManage = true;
  try {
    await requirePermission('deployments.view');
  } catch {
    return <AccessDenied requiredPermission="deployments.view" />;
  }
  try {
    await requirePermission('deployments.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('deployments').select('*').order('created_at', { ascending: false }).limit(200);
  const deployments = (data ?? []) as Deployment[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Deployment Management</h1>
          <p className="text-sm text-[#707975] mt-1">Most recent 200 deployments across every application and environment.</p>
        </div>
        {canManage && <AddDeploymentForm />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load deployments: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1300px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Application</th>
              <th className="px-4 py-3">Environment</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Started By</th>
              <th className="px-4 py-3">Start Time</th>
              <th className="px-4 py-3">End Time</th>
              <th className="px-4 py-3">Result</th>
              <th className="px-4 py-3">Rollback Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {deployments.map((d) => (
              <tr key={d.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">{d.application}</td>
                <td className="px-4 py-3 text-[#3f4945] capitalize">{d.environment}</td>
                <td className="px-4 py-3 text-[#3f4945] font-mono text-xs">{d.version}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <InlineSelect
                      value={d.status}
                      options={DEPLOYMENT_STATUSES}
                      onSave={updateDeploymentStatus.bind(null, d.id)}
                      className={`border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none ${STATUS_COLORS[d.status] ?? ''}`}
                    />
                  ) : (
                    <span className={`text-xs font-medium ${STATUS_COLORS[d.status] ?? ''}`}>{labelFor(DEPLOYMENT_STATUSES, d.status)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{d.started_by ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">{formatDateTime(d.start_time)}</td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">{formatDateTime(d.end_time)}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945] max-w-[200px] break-words">{d.result ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{labelFor(ROLLBACK_STATUSES, d.rollback_status)}</td>
                <td className="px-4 py-3">
                  {canManage && d.status !== 'rolled_back' && (
                    <RollbackDeploymentButton id={d.id} />
                  )}
                </td>
              </tr>
            ))}
            {deployments.length === 0 && !error && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No deployments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
