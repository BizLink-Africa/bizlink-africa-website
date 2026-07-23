'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { POLICY_CATEGORIES } from '@/data/governance';
import { createPolicy, type PolicyInput } from '@/app/admin/(protected)/governance/policies/actions';

const initialForm = {
  title: '',
  category: POLICY_CATEGORIES[0].value,
  version: '1.0',
  effectiveDate: '',
  reviewDate: '',
  owner: '',
  content: '',
  fileUrl: '',
  acknowledgementRequired: false,
};

export default function CreatePolicyForm() {
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

    const result = await createPolicy(form as PolicyInput);
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to create policy document.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> New Policy
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">New Policy Document</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="title">Title</label>
          <input id="title" name="title" value={form.title} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="category">Category</label>
          <select id="category" name="category" value={form.category} onChange={handleChange} className={inputClass}>
            {POLICY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="version">Version</label>
          <input id="version" name="version" value={form.version} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="owner">Owner</label>
          <input id="owner" name="owner" value={form.owner} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="effectiveDate">Effective Date</label>
          <input id="effectiveDate" name="effectiveDate" type="date" value={form.effectiveDate} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="reviewDate">Review Date</label>
          <input id="reviewDate" name="reviewDate" type="date" value={form.reviewDate} onChange={handleChange} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="fileUrl">File URL</label>
          <input id="fileUrl" name="fileUrl" value={form.fileUrl} onChange={handleChange} placeholder="https://..." className={inputClass} />
        </div>
        <div className="flex items-end pb-2.5">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#1b1c1c]">
            <input
              type="checkbox"
              checked={form.acknowledgementRequired}
              onChange={(e) => setForm((prev) => ({ ...prev, acknowledgementRequired: e.target.checked }))}
              className="accent-[#00342b]"
            />
            Requires staff acknowledgement
          </label>
        </div>
        <div className="sm:col-span-3">
          <label className={labelClass} htmlFor="content">Content</label>
          <textarea id="content" name="content" value={form.content} onChange={handleChange} rows={5} className={inputClass} />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Creating...' : 'Create Policy'}
      </button>
    </form>
  );
}
