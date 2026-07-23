import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { ERROR_CATEGORIES, type ApiRequestLog } from '@/data/apiLogs';
import { labelFor } from '@/data/inquiries';
import { maskSecrets } from '@/lib/security/mask';
import AddApiLogForm from '@/components/admin/AddApiLogForm';

export const dynamic = 'force-dynamic';

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function codeColor(code: number): string {
  if (code >= 500) return 'text-[#8a1f1f]';
  if (code >= 400) return 'text-[#8a5a00]';
  return 'text-[#1b7a3d]';
}

interface ApiLogRow extends ApiRequestLog {
  clients: { client_name: string } | null;
}

export default async function ApiMonitoringPage() {
  let canManage = true;
  try {
    await requirePermission('api_logs.view');
  } catch {
    return <AccessDenied requiredPermission="api_logs.view" />;
  }
  try {
    await requirePermission('api_logs.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();

  const [{ data: clients }, { data, error }] = await Promise.all([
    supabase.from('clients').select('id, client_name, business_name').order('client_name', { ascending: true }),
    supabase
      .from('api_request_logs')
      .select('*, clients(client_name)')
      .order('occurred_at', { ascending: false })
      .limit(200),
  ]);

  const logs = (data ?? []) as unknown as ApiLogRow[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">API Monitoring</h1>
          <p className="text-sm text-[#707975] mt-1">
            Most recent 200 requests. Endpoints are shown with secret-shaped substrings masked — never full API keys, tokens, or credentials.
          </p>
        </div>
        {canManage && <AddApiLogForm clients={clients ?? []} />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load API logs: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1300px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Endpoint</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Response Code</th>
              <th className="px-4 py-3">Response Time</th>
              <th className="px-4 py-3">Correlation ID</th>
              <th className="px-4 py-3">Error Category</th>
              <th className="px-4 py-3">Retries</th>
              <th className="px-4 py-3">Environment</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">{formatDateTime(log.occurred_at)}</td>
                <td className="px-4 py-3 text-[#3f4945]">{log.clients?.client_name ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945] break-all max-w-[280px] font-mono">{maskSecrets(log.endpoint)}</td>
                <td className="px-4 py-3 text-[#3f4945] font-mono text-xs">{log.method}</td>
                <td className={`px-4 py-3 font-medium ${codeColor(log.response_code)}`}>{log.response_code}</td>
                <td className="px-4 py-3 text-[#3f4945]">{log.response_time_ms != null ? `${log.response_time_ms}ms` : '—'}</td>
                <td className="px-4 py-3 text-xs text-[#707975] font-mono">{log.correlation_id ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{labelFor(ERROR_CATEGORIES, log.error_category)}</td>
                <td className="px-4 py-3 text-[#3f4945]">{log.retry_count}</td>
                <td className="px-4 py-3 text-[#3f4945] capitalize">{log.environment}</td>
              </tr>
            ))}
            {logs.length === 0 && !error && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No API requests logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
