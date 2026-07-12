'use client';

import { useState, useTransition } from 'react';
import { SERVICE_CATALOG, SERVICE_STATUSES, type ServiceStatus } from '@/data/services';
import { updateClientService } from '@/app/admin/(protected)/clients/actions';

export default function ClientServicesPanel({
  clientId,
  initialStatuses,
}: {
  clientId: string;
  initialStatuses: Partial<Record<string, ServiceStatus>>;
}) {
  const [statuses, setStatuses] = useState(initialStatuses);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleChange = (serviceKey: string, status: ServiceStatus) => {
    const previous = statuses[serviceKey] ?? 'inactive';
    setStatuses((prev) => ({ ...prev, [serviceKey]: status }));
    setPendingKey(serviceKey);
    setError(null);

    startTransition(async () => {
      const result = await updateClientService(clientId, serviceKey, status);
      setPendingKey(null);
      if (!result.success) {
        setStatuses((prev) => ({ ...prev, [serviceKey]: previous }));
        setError(result.message ?? 'Failed to update service.');
      }
    });
  };

  return (
    <div className="bg-white border border-[#bfc9c4] p-6 space-y-4">
      <h2 className="font-[Geist,sans-serif] font-semibold text-[#00342b]">Services</h2>

      <ul className="divide-y divide-[#e5e5e5]">
        {SERVICE_CATALOG.map((service) => {
          const status = statuses[service.value] ?? 'inactive';
          return (
            <li key={service.value} className="py-3 flex items-center justify-between gap-4">
              <span className="text-sm text-[#1b1c1c]">{service.label}</span>
              <select
                value={status}
                onChange={(e) => handleChange(service.value, e.target.value as ServiceStatus)}
                disabled={pendingKey === service.value}
                className="border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none"
              >
                {SERVICE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>

      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
