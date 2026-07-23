'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { SECURITY_EVENT_TYPES, SECURITY_SEVERITIES } from '@/data/compliance';
import { logSecurityEvent, type SecurityEventInput } from '@/app/admin/(protected)/compliance/security-events/actions';

const initialForm = {
  eventType: SECURITY_EVENT_TYPES[0].value,
  severity: SECURITY_SEVERITIES[0].value,
  description: '',
  actor: '',
  ipAddress: '',
  device: '',
  result: '',
};

export default function LogSecurityEventForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await logSecurityEvent(form as SecurityEventInput);
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to log security event.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> Log Event
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">Log Security Event</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass} htmlFor="eventType">Event Type</label>
          <select id="eventType" name="eventType" value={form.eventType} onChange={handleChange} className={inputClass}>
            {SECURITY_EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="severity">Severity</label>
          <select id="severity" name="severity" value={form.severity} onChange={handleChange} className={inputClass}>
            {SECURITY_SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="actor">Actor</label>
          <input id="actor" name="actor" value={form.actor} onChange={handleChange} placeholder="Who/what triggered this" className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="description">Description</label>
          <textarea id="description" name="description" value={form.description} onChange={handleChange} required rows={3} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="ipAddress">IP Address</label>
          <input id="ipAddress" name="ipAddress" value={form.ipAddress} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="device">Device</label>
          <input id="device" name="device" value={form.device} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="result">Result</label>
          <input id="result" name="result" value={form.result} onChange={handleChange} placeholder="blocked, allowed, failed" className={inputClass} />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Logging...' : 'Log Event'}
      </button>
    </form>
  );
}
