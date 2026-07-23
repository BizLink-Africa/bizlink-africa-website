'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { WEBHOOK_DELIVERY_STATUSES } from '@/data/webhooks';
import { createWebhookDelivery } from '@/app/admin/(protected)/webhook-monitoring/actions';

const initialForm = {
  clientId: '',
  endpoint: '',
  event: '',
  deliveryStatus: 'pending',
  responseSummary: '',
  retryCount: 0,
  failureReason: '',
  nextRetryAt: '',
};

export default function AddWebhookDeliveryForm({ clients }: { clients: Array<{ id: string; client_name: string; business_name: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createWebhookDelivery({
      ...form,
      clientId: form.clientId || undefined,
      retryCount: Number(form.retryCount) || 0,
      nextRetryAt: form.nextRetryAt || undefined,
    });
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to record webhook delivery.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> Log Webhook Delivery
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">Log Webhook Delivery</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="clientId">Client</label>
          <select
            id="clientId"
            value={form.clientId}
            onChange={(e) => setForm((prev) => ({ ...prev, clientId: e.target.value }))}
            className={inputClass}
          >
            <option value="">No client linked</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.client_name} — {c.business_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="event">Event</label>
          <input
            id="event"
            value={form.event}
            onChange={(e) => setForm((prev) => ({ ...prev, event: e.target.value }))}
            placeholder="order.created"
            required
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="endpoint">Endpoint</label>
          <input
            id="endpoint"
            value={form.endpoint}
            onChange={(e) => setForm((prev) => ({ ...prev, endpoint: e.target.value }))}
            placeholder="https://..."
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="deliveryStatus">Delivery Status</label>
          <select
            id="deliveryStatus"
            value={form.deliveryStatus}
            onChange={(e) => setForm((prev) => ({ ...prev, deliveryStatus: e.target.value }))}
            className={inputClass}
          >
            {WEBHOOK_DELIVERY_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="retryCount">Retry Count</label>
          <input
            id="retryCount"
            type="number"
            min={0}
            value={form.retryCount}
            onChange={(e) => setForm((prev) => ({ ...prev, retryCount: Number(e.target.value) }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="responseSummary">Response Summary</label>
          <input
            id="responseSummary"
            value={form.responseSummary}
            onChange={(e) => setForm((prev) => ({ ...prev, responseSummary: e.target.value }))}
            placeholder="200 OK"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="nextRetryAt">Next Retry At</label>
          <input
            id="nextRetryAt"
            type="datetime-local"
            value={form.nextRetryAt}
            onChange={(e) => setForm((prev) => ({ ...prev, nextRetryAt: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="failureReason">Failure Reason (if any)</label>
          <input
            id="failureReason"
            value={form.failureReason}
            onChange={(e) => setForm((prev) => ({ ...prev, failureReason: e.target.value }))}
            className={inputClass}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Recording...' : 'Record Delivery'}
      </button>
    </form>
  );
}
