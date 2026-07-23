'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateSecurityIncidentContainmentResolution } from '@/app/admin/(protected)/security/incidents/actions';

export default function SecurityIncidentContainmentForm({
  id,
  initialContainment,
  initialResolution,
  initialOwner,
}: {
  id: string;
  initialContainment: string | null;
  initialResolution: string | null;
  initialOwner: string | null;
}) {
  const router = useRouter();
  const [containment, setContainment] = useState(initialContainment ?? '');
  const [resolution, setResolution] = useState(initialResolution ?? '');
  const [owner, setOwner] = useState(initialOwner ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);

    const result = await updateSecurityIncidentContainmentResolution(id, { containment, resolution, owner });
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
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-3">
      <h3 className="font-semibold text-[#00342b] text-sm">Owner, Containment &amp; Resolution</h3>
      <div>
        <label className={labelClass} htmlFor="owner">Owner</label>
        <input id="owner" value={owner} onChange={(e) => setOwner(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="containment">Containment</label>
        <textarea id="containment" value={containment} onChange={(e) => setContainment(e.target.value)} rows={3} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="resolution">Resolution</label>
        <textarea id="resolution" value={resolution} onChange={(e) => setResolution(e.target.value)} rows={3} className={inputClass} />
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
      {saved && !error && <p className="text-sm text-[#1b7a3d]">Saved.</p>}
      <button type="submit" disabled={submitting} className="bg-[#00342b] text-white px-5 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {submitting ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
