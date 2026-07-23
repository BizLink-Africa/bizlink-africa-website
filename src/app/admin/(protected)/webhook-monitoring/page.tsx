import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { WEBHOOK_DELIVERY_STATUSES, type WebhookDelivery } from '@/data/webhooks';
import AddWebhookDeliveryForm from '@/components/admin/AddWebhookDeliveryForm';
import InlineSelect from '@/components/admin/InlineSelect';
import { updateWebhookDeliveryStatus } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-[#707975]',
  delivered: 'text-[#1b7a3d]',
  failed: 'text-[#8a1f1f]',
  retrying: 'text-[#8a5a00]',
};

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

interface WebhookRow extends WebhookDelivery {
  clients: { client_name: string } | null;
}

export default async function WebhookMonitoringPage() {
  let canManage = true;
  try {
    await requirePermission('webhooks.view');
  } catch {
    return <AccessDenied requiredPermission="webhooks.view" />;
  }
  try {
    await requirePermission('webhooks.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();

  const [{ data: clients }, { data, error }] = await Promise.all([
    supabase.from('clients').select('id, client_name, business_name').order('client_name', { ascending: true }),
    supabase.from('webhook_deliveries').select('*, clients(client_name)').order('created_at', { ascending: false }).limit(200),
  ]);

  const deliveries = (data ?? []) as unknown as WebhookRow[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Webhook Monitoring</h1>
          <p className="text-sm text-[#707975] mt-1">Most recent 200 delivery attempts across every client webhook.</p>
        </div>
        {canManage && <AddWebhookDeliveryForm clients={clients ?? []} />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load webhook deliveries: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1200px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Endpoint</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Delivery Status</th>
              <th className="px-4 py-3">Response</th>
              <th className="px-4 py-3">Retries</th>
              <th className="px-4 py-3">Failure Reason</th>
              <th className="px-4 py-3">Next Retry</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-xs text-[#3f4945] break-all max-w-[240px] font-mono">{d.endpoint}</td>
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">{d.event}</td>
                <td className="px-4 py-3 text-[#3f4945]">{d.clients?.client_name ?? '—'}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <InlineSelect
                      value={d.delivery_status}
                      options={WEBHOOK_DELIVERY_STATUSES}
                      onSave={updateWebhookDeliveryStatus.bind(null, d.id)}
                      className={`border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none ${STATUS_COLORS[d.delivery_status] ?? ''}`}
                    />
                  ) : (
                    <span className={`text-xs font-medium ${STATUS_COLORS[d.delivery_status] ?? ''}`}>{d.delivery_status}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-[#707975] max-w-[180px] break-words">{d.response_summary ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{d.retry_count}</td>
                <td className="px-4 py-3 text-xs text-red-700 max-w-[200px] break-words">{d.failure_reason ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">{formatDateTime(d.next_retry_at)}</td>
              </tr>
            ))}
            {deliveries.length === 0 && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No webhook deliveries recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
