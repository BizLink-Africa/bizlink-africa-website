'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { RISK_LEVELS } from '@/data/compliance';
import { createDataProtectionActivity } from '@/app/admin/(protected)/compliance/data-protection/actions';

const initialForm = {
  processingActivity: '',
  dataCategory: '',
  purpose: '',
  legalBasis: '',
  retentionPeriod: '',
  accessRoles: '',
  riskLevel: 'low',
  reviewDate: '',
};

export default function AddDataProtectionActivityForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createDataProtectionActivity({
      processingActivity: form.processingActivity,
      dataCategory: form.dataCategory,
      purpose: form.purpose || undefined,
      legalBasis: form.legalBasis || undefined,
      retentionPeriod: form.retentionPeriod || undefined,
      accessRoles: form.accessRoles.split(',').map((s) => s.trim()).filter(Boolean),
      riskLevel: form.riskLevel,
      reviewDate: form.reviewDate || undefined,
    });
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to save data protection activity.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> Add Processing Activity
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">Add Data Processing Activity</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="processingActivity">Processing Activity</label>
          <input id="processingActivity" value={form.processingActivity} onChange={(e) => setForm((p) => ({ ...p, processingActivity: e.target.value }))} placeholder="Client onboarding KYC" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="dataCategory">Data Category</label>
          <input id="dataCategory" value={form.dataCategory} onChange={(e) => setForm((p) => ({ ...p, dataCategory: e.target.value }))} placeholder="Personal identification data" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="purpose">Purpose</label>
          <input id="purpose" value={form.purpose} onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="legalBasis">Legal Basis</label>
          <input id="legalBasis" value={form.legalBasis} onChange={(e) => setForm((p) => ({ ...p, legalBasis: e.target.value }))} placeholder="Contract, Consent, Legal Obligation" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="retentionPeriod">Retention Period</label>
          <input id="retentionPeriod" value={form.retentionPeriod} onChange={(e) => setForm((p) => ({ ...p, retentionPeriod: e.target.value }))} placeholder="7 years" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="riskLevel">Risk</label>
          <select id="riskLevel" value={form.riskLevel} onChange={(e) => setForm((p) => ({ ...p, riskLevel: e.target.value }))} className={inputClass}>
            {RISK_LEVELS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="accessRoles">Access Roles (comma-separated)</label>
          <input id="accessRoles" value={form.accessRoles} onChange={(e) => setForm((p) => ({ ...p, accessRoles: e.target.value }))} placeholder="operations, cfo" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="reviewDate">Review Date</label>
          <input id="reviewDate" type="date" value={form.reviewDate} onChange={(e) => setForm((p) => ({ ...p, reviewDate: e.target.value }))} className={inputClass} />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button type="submit" disabled={submitting} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {submitting ? 'Saving...' : 'Save Activity'}
      </button>
    </form>
  );
}
