'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { HEALTH_STATUSES } from '@/data/systemHealth';
import { createDatabaseHealthMetric } from '@/app/admin/(protected)/database-health/actions';

const initialForm = { metricName: '', value: '', unit: '', status: 'operational' };

export default function AddDatabaseHealthMetricForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createDatabaseHealthMetric({
      metricName: form.metricName,
      value: form.value ? Number(form.value) : undefined,
      unit: form.unit || undefined,
      status: form.status,
    });
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to record metric.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> Record Metric
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">Record Database Health Metric</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="metricName">Metric Name</label>
          <input
            id="metricName"
            value={form.metricName}
            onChange={(e) => setForm((prev) => ({ ...prev, metricName: e.target.value }))}
            placeholder="Active Connections"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="status">Status</label>
          <select
            id="status"
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
            className={inputClass}
          >
            {HEALTH_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="value">Value</label>
          <input
            id="value"
            type="number"
            value={form.value}
            onChange={(e) => setForm((prev) => ({ ...prev, value: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="unit">Unit</label>
          <input
            id="unit"
            value={form.unit}
            onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
            placeholder="ms, %, connections"
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
        {submitting ? 'Recording...' : 'Record Metric'}
      </button>
    </form>
  );
}
