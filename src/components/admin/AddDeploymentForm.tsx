'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { DEPLOYMENT_ENVIRONMENTS, DEPLOYMENT_STATUSES } from '@/data/deployments';
import { createDeployment } from '@/app/admin/(protected)/deployments/actions';

const initialForm = {
  application: '',
  environment: 'production',
  version: '',
  status: 'pending',
  startedBy: '',
  result: '',
};

export default function AddDeploymentForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createDeployment(form);
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to record deployment.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> Record Deployment
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">Record Deployment</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="application">Application</label>
          <input
            id="application"
            value={form.application}
            onChange={(e) => setForm((prev) => ({ ...prev, application: e.target.value }))}
            placeholder="bizlink-website"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="version">Version</label>
          <input
            id="version"
            value={form.version}
            onChange={(e) => setForm((prev) => ({ ...prev, version: e.target.value }))}
            placeholder="v1.4.0"
            required
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
            {DEPLOYMENT_ENVIRONMENTS.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="status">Status</label>
          <select
            id="status"
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
            className={inputClass}
          >
            {DEPLOYMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="startedBy">Started By</label>
          <input
            id="startedBy"
            value={form.startedBy}
            onChange={(e) => setForm((prev) => ({ ...prev, startedBy: e.target.value }))}
            placeholder="Defaults to you"
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="result">Result Notes</label>
          <input
            id="result"
            value={form.result}
            onChange={(e) => setForm((prev) => ({ ...prev, result: e.target.value }))}
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
        {submitting ? 'Recording...' : 'Record Deployment'}
      </button>
    </form>
  );
}
