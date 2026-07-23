'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { API_STATUSES, INTEGRATION_TYPES, ENVIRONMENTS, WEBHOOK_STATUSES } from '@/data/integrations';
import { SERVICE_CATALOG } from '@/data/services';
import { createIntegrationRecord } from '@/app/admin/(protected)/integration-health/actions';

const initialForm = {
  clientId: '',
  serviceType: SERVICE_CATALOG[0].label as string,
  integrationType: '',
  environment: 'production',
  apiStatus: 'pending_setup',
  webhookEndpoint: '',
  webhookStatus: 'not_configured',
  errorMessage: '',
  technicalOwner: '',
};

export default function AddIntegrationForm({ clients }: { clients: Array<{ id: string; client_name: string; business_name: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createIntegrationRecord(form);
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to create integration record.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> Add Integration Record
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">Add Integration Record</h2>
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
          <label className={labelClass} htmlFor="serviceType">Service Type</label>
          <select
            id="serviceType"
            value={form.serviceType}
            onChange={(e) => setForm((prev) => ({ ...prev, serviceType: e.target.value }))}
            className={inputClass}
          >
            {SERVICE_CATALOG.map((s) => (
              <option key={s.value} value={s.label}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="integrationType">Integration Type</label>
          <select
            id="integrationType"
            value={form.integrationType}
            onChange={(e) => setForm((prev) => ({ ...prev, integrationType: e.target.value }))}
            className={inputClass}
          >
            <option value="">Unspecified</option>
            {INTEGRATION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
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
        <div>
          <label className={labelClass} htmlFor="apiStatus">API Status</label>
          <select
            id="apiStatus"
            value={form.apiStatus}
            onChange={(e) => setForm((prev) => ({ ...prev, apiStatus: e.target.value }))}
            className={inputClass}
          >
            {API_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="technicalOwner">Technical Owner</label>
          <input
            id="technicalOwner"
            value={form.technicalOwner}
            onChange={(e) => setForm((prev) => ({ ...prev, technicalOwner: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="webhookEndpoint">Webhook Endpoint</label>
          <input
            id="webhookEndpoint"
            value={form.webhookEndpoint}
            onChange={(e) => setForm((prev) => ({ ...prev, webhookEndpoint: e.target.value }))}
            placeholder="https://..."
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="webhookStatus">Webhook Status</label>
          <select
            id="webhookStatus"
            value={form.webhookStatus}
            onChange={(e) => setForm((prev) => ({ ...prev, webhookStatus: e.target.value }))}
            className={inputClass}
          >
            {WEBHOOK_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="errorMessage">Error Message (if any)</label>
          <input
            id="errorMessage"
            value={form.errorMessage}
            onChange={(e) => setForm((prev) => ({ ...prev, errorMessage: e.target.value }))}
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
        {submitting ? 'Creating...' : 'Create Record'}
      </button>
    </form>
  );
}
