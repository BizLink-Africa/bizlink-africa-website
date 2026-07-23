'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SERVICE_CATALOG, DELIVERY_STATUSES, type ClientService, type DeliveryStatus } from '@/data/services';
import { updateServiceDelivery } from '@/app/admin/(protected)/service-delivery/actions';

const SERVICE_LABELS = Object.fromEntries(SERVICE_CATALOG.map((s) => [s.value, s.label]));

const STATUS_STYLES: Record<DeliveryStatus, string> = {
  not_started: 'bg-[#eeeeee] text-[#3f4945]',
  scheduled: 'bg-[#e6e6fa] text-[#3d3d9e]',
  in_progress: 'bg-[#fff3d6] text-[#8a5a00]',
  delivered: 'bg-[#dcf5e3] text-[#1b7a3d]',
  on_hold: 'bg-[#fbeada] text-[#8a5a00]',
  cancelled: 'bg-[#fbdada] text-[#8a1f1f]',
};

const FILTERS = [
  { key: 'pending', label: 'Not Delivered' },
  { key: 'all', label: 'All' },
] as const;

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ServiceDeliveryRow({ row, clientName, readOnly }: { row: ClientService; clientName: string; readOnly: boolean }) {
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>(row.delivery_status);
  const [scheduledDate, setScheduledDate] = useState(row.scheduled_date ?? '');
  const [assignedTo, setAssignedTo] = useState(row.assigned_to ?? '');
  const [deliveryNotes, setDeliveryNotes] = useState(row.delivery_notes ?? '');
  const [saved, setSaved] = useState({ deliveryStatus, scheduledDate, assignedTo, deliveryNotes });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    deliveryStatus !== saved.deliveryStatus ||
    scheduledDate !== saved.scheduledDate ||
    assignedTo !== saved.assignedTo ||
    deliveryNotes !== saved.deliveryNotes;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await updateServiceDelivery(row.id, {
      deliveryStatus,
      scheduledDate: scheduledDate || undefined,
      assignedTo: assignedTo || undefined,
      deliveryNotes: deliveryNotes || undefined,
    });
    setSaving(false);
    if (result.success) {
      setSaved({ deliveryStatus, scheduledDate, assignedTo, deliveryNotes });
    } else {
      setError(result.message ?? 'Failed to save.');
    }
  };

  const inputClass = 'w-full border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none disabled:bg-[#f5f3f3] disabled:text-[#707975]';

  return (
    <tr className="border-b border-[#e5e5e5] last:border-0 align-top">
      <td className="px-4 py-3">
        <Link href={`/admin/clients/${row.client_id}`} className="text-sm font-medium text-[#00342b] hover:underline">
          {clientName}
        </Link>
      </td>
      <td className="px-4 py-3 text-sm text-[#1b1c1c]">{SERVICE_LABELS[row.service_key] ?? row.service_key}</td>
      <td className="px-4 py-3">
        <select
          value={deliveryStatus}
          disabled={readOnly}
          onChange={(e) => setDeliveryStatus(e.target.value as DeliveryStatus)}
          className={inputClass}
        >
          {DELIVERY_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <span className={`mt-1 inline-block px-2 py-0.5 text-[10px] font-medium rounded-full ${STATUS_STYLES[row.delivery_status]}`}>
          current: {row.delivery_status.replace('_', ' ')}
        </span>
      </td>
      <td className="px-4 py-3">
        <input type="date" value={scheduledDate} disabled={readOnly} onChange={(e) => setScheduledDate(e.target.value)} className={inputClass} />
      </td>
      <td className="px-4 py-3">
        <input value={assignedTo} disabled={readOnly} onChange={(e) => setAssignedTo(e.target.value)} placeholder="Unassigned" className={inputClass} />
      </td>
      <td className="px-4 py-3 text-xs text-[#707975]">{formatDate(row.delivered_at)}</td>
      <td className="px-4 py-3">
        <input value={deliveryNotes} disabled={readOnly} onChange={(e) => setDeliveryNotes(e.target.value)} placeholder="Notes" className={inputClass} />
        {error && <p className="mt-1 text-[10px] text-red-700">{error}</p>}
      </td>
      {!readOnly && (
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="bg-[#00342b] text-white px-3 py-1.5 text-xs font-medium hover:bg-[#004d40] transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
          </button>
        </td>
      )}
    </tr>
  );
}

export default function ServiceDeliveryTable({
  rows,
  clientNames,
  readOnly,
}: {
  rows: ClientService[];
  clientNames: Record<string, string>;
  readOnly: boolean;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('pending');

  const visibleRows = rows.filter((r) => (filter === 'pending' ? !['delivered', 'cancelled'].includes(r.delivery_status) : true));

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-medium border ${filter === f.key ? 'bg-[#00342b] text-white border-[#00342b]' : 'bg-white text-[#3f4945] border-[#bfc9c4] hover:border-[#00342b]'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Delivery Status</th>
              <th className="px-4 py-3">Scheduled Date</th>
              <th className="px-4 py-3">Assigned To</th>
              <th className="px-4 py-3">Delivered</th>
              <th className="px-4 py-3">Notes</th>
              {!readOnly && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <ServiceDeliveryRow key={row.id} row={row} clientName={clientNames[row.client_id] ?? '—'} readOnly={readOnly} />
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 7 : 8} className="px-4 py-10 text-center text-sm text-[#707975]">
                  {filter === 'pending' ? 'Nothing pending delivery.' : 'No services assigned to any client yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
