'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HEALTH_STATUSES } from '@/data/systemHealth';
import { updateSystemHealthCheck } from '@/app/admin/(protected)/system-health/actions';

const STATUS_COLORS: Record<string, string> = {
  operational: 'text-[#1b7a3d]',
  degraded: 'text-[#8a5a00]',
  down: 'text-[#8a1f1f]',
};

export default function SystemHealthCheckRow({
  id,
  label,
  initialStatus,
  initialDetail,
  errorRate,
  canManage,
}: {
  id: string;
  label: string;
  initialStatus: string;
  initialDetail: string | null;
  errorRate: number | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [detail, setDetail] = useState(initialDetail ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) {
    return (
      <tr className="border-b border-[#e5e5e5] last:border-0">
        <td className="px-4 py-3 font-medium text-[#1b1c1c]">{label}</td>
        <td className={`px-4 py-3 text-xs font-medium ${STATUS_COLORS[initialStatus] ?? ''}`}>{initialStatus}</td>
        <td className="px-4 py-3 text-xs text-[#3f4945]">{errorRate != null ? `${errorRate}%` : '—'}</td>
        <td className="px-4 py-3 text-xs text-[#3f4945]">{initialDetail || '—'}</td>
      </tr>
    );
  }

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);
    const result = await updateSystemHealthCheck(id, { status, detail });
    setSubmitting(false);
    if (result.success) {
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to save.');
    }
  };

  return (
    <tr className="border-b border-[#e5e5e5] last:border-0">
      <td className="px-4 py-3 font-medium text-[#1b1c1c] align-top">{label}</td>
      <td className="px-4 py-3 align-top">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={`border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none ${STATUS_COLORS[status] ?? ''}`}
        >
          {HEALTH_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 align-top text-xs text-[#3f4945]">{errorRate != null ? `${errorRate}%` : '—'}</td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2">
          <input
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Detail (optional)"
            className="border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none flex-1"
          />
          <button type="button" onClick={handleSave} disabled={submitting} className="text-xs font-medium text-white bg-[#00342b] px-3 py-1.5 hover:bg-[#004d40] transition-colors disabled:opacity-50">
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </div>
        {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
      </td>
    </tr>
  );
}
