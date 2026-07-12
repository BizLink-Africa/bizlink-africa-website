import { createClient } from '@/lib/supabase/server';
import { API_STATUSES, type IntegrationHealth } from '@/data/integrations';
import AddIntegrationForm from '@/components/admin/AddIntegrationForm';
import InlineSelect from '@/components/admin/InlineSelect';
import { updateIntegrationStatus } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  active: 'text-[#1b7a3d]',
  warning: 'text-[#8a5a00]',
  failed: 'text-[#8a1f1f]',
  pending_setup: 'text-[#707975]',
  disabled: 'text-[#707975]',
};

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

interface IntegrationRow extends IntegrationHealth {
  clients: { client_name: string; business_name: string } | null;
}

export default async function IntegrationHealthPage() {
  const supabase = await createClient();

  const [{ data: clients }, { data, error }] = await Promise.all([
    supabase.from('clients').select('id, client_name, business_name').order('client_name', { ascending: true }),
    supabase.from('integration_health').select('*, clients(client_name, business_name)').order('created_at', { ascending: false }),
  ]);

  const records = (data ?? []) as unknown as IntegrationRow[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-[Geist,sans-serif] font-bold text-2xl text-[#00342b]">Integration Health</h1>
          <p className="text-sm text-[#707975] mt-1">
            Manually tracked status per client integration — not a live monitor.
          </p>
        </div>
        <AddIntegrationForm clients={clients ?? []} />
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load integration records: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Service Type</th>
              <th className="px-4 py-3">API Status</th>
              <th className="px-4 py-3">Webhook</th>
              <th className="px-4 py-3">Last Success</th>
              <th className="px-4 py-3">Last Failure</th>
              <th className="px-4 py-3">Error</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-[#3f4945]">{record.clients?.client_name ?? '—'}</td>
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">{record.service_type}</td>
                <td className="px-4 py-3">
                  <InlineSelect
                    value={record.api_status}
                    options={API_STATUSES}
                    onSave={updateIntegrationStatus.bind(null, record.id)}
                    className={`border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none ${STATUS_COLORS[record.api_status] ?? ''}`}
                  />
                </td>
                <td className="px-4 py-3 text-xs text-[#3f4945] break-all max-w-[200px]">{record.webhook_endpoint ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">{formatDateTime(record.last_successful_request)}</td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">{formatDateTime(record.last_failed_request)}</td>
                <td className="px-4 py-3 text-xs text-red-700 max-w-[200px] break-words">{record.error_message ?? '—'}</td>
              </tr>
            ))}
            {records.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No integration records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
