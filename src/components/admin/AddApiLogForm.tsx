'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { HTTP_METHODS, ERROR_CATEGORIES } from '@/data/apiLogs';
import { ENVIRONMENTS } from '@/data/integrations';
import { createApiLog } from '@/app/admin/(protected)/api-monitoring/actions';

const initialForm = {
  clientId: '',
  endpoint: '',
  method: 'GET' as string,
  responseCode: 200,
  responseTimeMs: '',
  correlationId: '',
  errorCategory: 'none',
  retryCount: 0,
  environment: 'production',
};

export default function AddApiLogForm({ clients }: { clients: Array<{ id: string; client_name: string; business_name: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createApiLog({
      ...form,
      clientId: form.clientId || undefined,
      responseCode: Number(form.responseCode),
      responseTimeMs: form.responseTimeMs ? Number(form.responseTimeMs) : undefined,
      retryCount: Number(form.retryCount) || 0,
    });
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to record API log entry.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> Log Request
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">Log API Request</h2>
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
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="endpoint">Endpoint</label>
          <input
            id="endpoint"
            value={form.endpoint}
            onChange={(e) => setForm((prev) => ({ ...prev, endpoint: e.target.value }))}
            placeholder="/api/v1/clients"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="method">Method</label>
          <select
            id="method"
            value={form.method}
            onChange={(e) => setForm((prev) => ({ ...prev, method: e.target.value }))}
            className={inputClass}
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="responseCode">Response Code</label>
          <input
            id="responseCode"
            type="number"
            value={form.responseCode}
            onChange={(e) => setForm((prev) => ({ ...prev, responseCode: Number(e.target.value) }))}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="responseTimeMs">Response Time (ms)</label>
          <input
            id="responseTimeMs"
            type="number"
            value={form.responseTimeMs}
            onChange={(e) => setForm((prev) => ({ ...prev, responseTimeMs: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="correlationId">Correlation ID</label>
          <input
            id="correlationId"
            value={form.correlationId}
            onChange={(e) => setForm((prev) => ({ ...prev, correlationId: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="errorCategory">Error Category</label>
          <select
            id="errorCategory"
            value={form.errorCategory}
            onChange={(e) => setForm((prev) => ({ ...prev, errorCategory: e.target.value }))}
            className={inputClass}
          >
            {ERROR_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
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
          <label className={labelClass} htmlFor="environment">Environment</label>
          <select
            id="environment"
            value={form.environment}
            onChange={(e) => setForm((prev) => ({ ...prev, environment: e.target.value }))}
            className={inputClass}
          >
            {ENVIRONMENTS.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Recording...' : 'Record Entry'}
      </button>
    </form>
  );
}
