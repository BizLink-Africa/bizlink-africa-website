'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { INCIDENT_SEVERITIES } from '@/data/technicalIncidents';
import { createIncident } from '@/app/admin/(protected)/technical-incidents/actions';

const initialForm = {
  title: '',
  severity: 'medium',
  affectedSystems: '',
  affectedClientIds: [] as string[],
};

export default function AddIncidentForm({ clients }: { clients: Array<{ id: string; client_name: string; business_name: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createIncident({
      title: form.title,
      severity: form.severity,
      affectedSystems: form.affectedSystems.split(',').map((s) => s.trim()).filter(Boolean),
      affectedClients: form.affectedClientIds,
    });
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to open incident.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> Open Incident
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">Open Incident</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="title">Title</label>
          <input
            id="title"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="severity">Severity</label>
          <select
            id="severity"
            value={form.severity}
            onChange={(e) => setForm((prev) => ({ ...prev, severity: e.target.value }))}
            className={inputClass}
          >
            {INCIDENT_SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="affectedSystems">Affected Systems (comma-separated)</label>
          <input
            id="affectedSystems"
            value={form.affectedSystems}
            onChange={(e) => setForm((prev) => ({ ...prev, affectedSystems: e.target.value }))}
            placeholder="API, Payment Gateway"
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="affectedClientIds">Affected Clients</label>
          <select
            id="affectedClientIds"
            multiple
            value={form.affectedClientIds}
            onChange={(e) => setForm((prev) => ({ ...prev, affectedClientIds: Array.from(e.target.selectedOptions, (o) => o.value) }))}
            className={`${inputClass} h-28`}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.client_name} — {c.business_name}</option>
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
        {submitting ? 'Opening...' : 'Open Incident'}
      </button>
    </form>
  );
}
