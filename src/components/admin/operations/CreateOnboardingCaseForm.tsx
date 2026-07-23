'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createOnboardingCase } from '@/app/admin/(protected)/onboarding/pipeline/actions';

interface Option {
  id: string;
  business_name: string;
}

export default function CreateOnboardingCaseForm({ clients, leads }: { clients: Option[]; leads: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<'client' | 'lead'>('lead');
  const [selectedId, setSelectedId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) {
      setError('Select a client or lead.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const result = await createOnboardingCase(
      source === 'client' ? { clientId: selectedId } : { leadId: selectedId }
    );
    setSubmitting(false);

    if (result.success && result.id) {
      router.push(`/admin/onboarding/pipeline/${result.id}`);
    } else {
      setError(result.message ?? 'Failed to create onboarding case.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> New Case
      </button>
    );
  }

  const options = source === 'client' ? clients : leads;

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-4 absolute right-6 top-24 z-10 w-96 shadow-lg">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">New Onboarding Case</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div>
        <label className={labelClass}>Source</label>
        <div className="flex gap-1 bg-[#f5f3f3] border border-[#bfc9c4] p-1">
          {(['lead', 'client'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSource(s);
                setSelectedId('');
              }}
              className={`flex-1 px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                source === s ? 'bg-[#00342b] text-white' : 'text-[#3f4945]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="selectedId">{source === 'client' ? 'Client' : 'Lead'}</label>
        <select id="selectedId" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={inputClass}>
          <option value="">Select {source}...</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.business_name}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Creating...' : 'Create Case'}
      </button>
    </form>
  );
}
