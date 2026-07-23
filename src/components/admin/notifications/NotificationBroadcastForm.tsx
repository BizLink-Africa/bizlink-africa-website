'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createNotification } from '@/app/admin/(protected)/notifications/actions';
import { DEPARTMENT_NAMES } from '@/data/departments';

const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
const initialForm = { title: '', message: '', priority: 'normal' as string, department: '' };

export default function NotificationBroadcastForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createNotification(form);
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to send notification.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> New Notification
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">Broadcast Notification</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="title">Title</label>
          <input id="title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="message">Message</label>
          <textarea id="message" value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} required rows={3} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="priority">Priority</label>
          <select id="priority" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} className={inputClass}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="department">Department</label>
          <select id="department" value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} className={inputClass}>
            <option value="">All staff</option>
            {DEPARTMENT_NAMES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button type="submit" disabled={submitting} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {submitting ? 'Sending...' : 'Send Notification'}
      </button>
    </form>
  );
}
