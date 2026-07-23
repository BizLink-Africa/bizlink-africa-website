'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { SECURITY_INCIDENT_SEVERITIES } from '@/data/securityIncidents';
import { createSecurityIncident } from '@/app/admin/(protected)/security/incidents/actions';

const initialForm = {
  title: '',
  severity: 'medium',
  affectedSystems: '',
  affectedUsers: '',
};

export default function AddSecurityIncidentForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createSecurityIncident({
      title: form.title,
      severity: form.severity,
      affectedSystems: form.affectedSystems.split(',').map((s) => s.trim()).filter(Boolean),
      affectedUsers: form.affectedUsers.split(',').map((s) => s.trim()).filter(Boolean),
    });
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to open security incident.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> Open Security Incident
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">Open Security Incident</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="title">Title</label>
          <input id="title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="severity">Severity</label>
          <select id="severity" value={form.severity} onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))} className={inputClass}>
            {SECURITY_INCIDENT_SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="affectedSystems">Affected Systems (comma-separated)</label>
          <input id="affectedSystems" value={form.affectedSystems} onChange={(e) => setForm((p) => ({ ...p, affectedSystems: e.target.value }))} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="affectedUsers">Affected Users (comma-separated emails)</label>
          <input id="affectedUsers" value={form.affectedUsers} onChange={(e) => setForm((p) => ({ ...p, affectedUsers: e.target.value }))} className={inputClass} />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button type="submit" disabled={submitting} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {submitting ? 'Opening...' : 'Open Incident'}
      </button>
    </form>
  );
}
