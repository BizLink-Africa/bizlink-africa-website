'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateTechnologySettings, type TechnologySettingsInput } from '@/app/admin/(protected)/technology/settings/actions';

export default function TechnologySettingsForm({ initial }: { initial: TechnologySettingsInput }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);

    const result = await updateTechnologySettings(form);
    setSubmitting(false);

    if (result.success) {
      setSaved(true);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to save.');
    }
  };

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-6 space-y-4">
      <div>
        <label className={labelClass} htmlFor="uptimeTargetPercentage">Platform Uptime Target (%)</label>
        <input
          id="uptimeTargetPercentage"
          type="number"
          step="0.01"
          min={0}
          max={100}
          value={form.uptimeTargetPercentage}
          onChange={(e) => setForm((prev) => ({ ...prev, uptimeTargetPercentage: Number(e.target.value) }))}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="apiResponseTimeTargetMs">API Response Time Target (ms)</label>
        <input
          id="apiResponseTimeTargetMs"
          type="number"
          min={0}
          value={form.apiResponseTimeTargetMs}
          onChange={(e) => setForm((prev) => ({ ...prev, apiResponseTimeTargetMs: Number(e.target.value) }))}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="incidentAlertEmail">Incident Alert Email</label>
        <input
          id="incidentAlertEmail"
          type="email"
          value={form.incidentAlertEmail}
          onChange={(e) => setForm((prev) => ({ ...prev, incidentAlertEmail: e.target.value }))}
          className={inputClass}
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer text-sm text-[#1b1c1c]">
        <input
          type="checkbox"
          checked={form.maintenanceMode}
          onChange={(e) => setForm((prev) => ({ ...prev, maintenanceMode: e.target.checked }))}
          className="accent-[#00342b]"
        />
        Maintenance mode
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#e5e5e5]">
        <div>
          <label className={labelClass} htmlFor="monitoringIntervalMinutes">Monitoring Interval (minutes)</label>
          <input
            id="monitoringIntervalMinutes"
            type="number"
            min={1}
            value={form.monitoringIntervalMinutes}
            onChange={(e) => setForm((prev) => ({ ...prev, monitoringIntervalMinutes: Number(e.target.value) }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="logsRetentionDays">Logs Retention (days)</label>
          <input
            id="logsRetentionDays"
            type="number"
            min={1}
            value={form.logsRetentionDays}
            onChange={(e) => setForm((prev) => ({ ...prev, logsRetentionDays: Number(e.target.value) }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="backupsRetentionDays">Backups Retention (days)</label>
          <input
            id="backupsRetentionDays"
            type="number"
            min={1}
            value={form.backupsRetentionDays}
            onChange={(e) => setForm((prev) => ({ ...prev, backupsRetentionDays: Number(e.target.value) }))}
            className={inputClass}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
      {saved && !error && <p className="text-sm text-[#1b7a3d]">Saved.</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Saving...' : 'Save Settings'}
      </button>
    </form>
  );
}
