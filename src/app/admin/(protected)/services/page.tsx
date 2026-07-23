import { createClient } from '@/lib/supabase/server';
import { SERVICE_CATALOG } from '@/data/services';

export const dynamic = 'force-dynamic';

interface ServiceCounts {
  active: number;
  pending: number;
  inactive: number;
}

export default async function ServicesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('client_services').select('service_key, status');

  const counts: Record<string, ServiceCounts> = {};
  for (const service of SERVICE_CATALOG) {
    counts[service.value] = { active: 0, pending: 0, inactive: 0 };
  }
  for (const row of data ?? []) {
    const bucket = counts[row.service_key];
    if (bucket && row.status in bucket) {
      (bucket as unknown as Record<string, number>)[row.status] += 1;
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Services</h1>
        <p className="text-sm text-[#707975] mt-1">Client adoption across BizLink Africa&apos;s service catalog.</p>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load services: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Active Clients</th>
              <th className="px-4 py-3">Pending</th>
              <th className="px-4 py-3">Inactive</th>
            </tr>
          </thead>
          <tbody>
            {SERVICE_CATALOG.map((service) => (
              <tr key={service.value} className="border-b border-[#e5e5e5] last:border-0">
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">{service.label}</td>
                <td className="px-4 py-3 text-[#1b7a3d] font-semibold">{counts[service.value].active}</td>
                <td className="px-4 py-3 text-[#8a5a00]">{counts[service.value].pending}</td>
                <td className="px-4 py-3 text-[#707975]">{counts[service.value].inactive}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-[#707975]">
        Assign or update services per client from that client&apos;s detail page.
      </p>
    </div>
  );
}
