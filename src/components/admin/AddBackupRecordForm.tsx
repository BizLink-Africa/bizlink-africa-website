'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { BACKUP_TYPES, BACKUP_STATUSES } from '@/data/backups';
import { createBackupRecord } from '@/app/admin/(protected)/backup-monitoring/actions';

const initialForm = {
  system: '',
  backupType: 'automated',
  status: 'scheduled',
  sizeMb: '',
  location: '',
  nextScheduledAt: '',
};

export default function AddBackupRecordForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createBackupRecord({
      system: form.system,
      backupType: form.backupType,
      status: form.status,
      sizeMb: form.sizeMb ? Number(form.sizeMb) : undefined,
      location: form.location || undefined,
      nextScheduledAt: form.nextScheduledAt || undefined,
    });
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to record backup.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> Record Backup
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">Record Backup</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="system">System</label>
          <input
            id="system"
            value={form.system}
            onChange={(e) => setForm((prev) => ({ ...prev, system: e.target.value }))}
            placeholder="Primary Database"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="backupType">Type</label>
          <select
            id="backupType"
            value={form.backupType}
            onChange={(e) => setForm((prev) => ({ ...prev, backupType: e.target.value }))}
            className={inputClass}
          >
            {BACKUP_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
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
            {BACKUP_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="sizeMb">Size (MB)</label>
          <input
            id="sizeMb"
            type="number"
            value={form.sizeMb}
            onChange={(e) => setForm((prev) => ({ ...prev, sizeMb: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="location">Location</label>
          <input
            id="location"
            value={form.location}
            onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="nextScheduledAt">Next Scheduled</label>
          <input
            id="nextScheduledAt"
            type="datetime-local"
            value={form.nextScheduledAt}
            onChange={(e) => setForm((prev) => ({ ...prev, nextScheduledAt: e.target.value }))}
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
        {submitting ? 'Recording...' : 'Record Backup'}
      </button>
    </form>
  );
}
