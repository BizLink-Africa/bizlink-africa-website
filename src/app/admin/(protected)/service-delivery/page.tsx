import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import ServiceDeliveryTable from '@/components/admin/ServiceDeliveryTable';
import type { ClientService } from '@/data/services';

export const dynamic = 'force-dynamic';

export default async function ServiceDeliveryPage() {
  try {
    await requirePermission('services.view');
  } catch {
    return <AccessDenied requiredPermission="services.view" />;
  }
  let canManage = true;
  try {
    await requirePermission('services.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const { data: services, error } = await supabase
    .from('client_services')
    .select('*')
    .order('scheduled_date', { ascending: true, nullsFirst: false });

  const rows = (services ?? []) as ClientService[];
  const clientIds = [...new Set(rows.map((r) => r.client_id))];
  const { data: clients } = clientIds.length
    ? await supabase.from('clients').select('id, business_name').in('id', clientIds)
    : { data: [] };
  const clientNames = new Map((clients ?? []).map((c) => [c.id, c.business_name]));

  const pendingDelivery = rows.filter((r) => !['delivered', 'cancelled'].includes(r.delivery_status));

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Service Delivery</h1>
        <p className="text-sm text-[#707975] mt-1">
          {pendingDelivery.length} service{pendingDelivery.length === 1 ? '' : 's'} not yet delivered, across {clientIds.length} client{clientIds.length === 1 ? '' : 's'}.
        </p>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load service delivery data: {error.message}
        </p>
      )}

      <ServiceDeliveryTable rows={rows} clientNames={Object.fromEntries(clientNames)} readOnly={!canManage} />
    </div>
  );
}
