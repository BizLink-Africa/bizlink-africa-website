'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { CONTRACT_REVIEW_STATUSES, CONTRACT_APPROVAL_STATUSES } from '@/data/contractCompliance';
import { upsertContractCompliance } from '@/app/admin/(protected)/compliance/contracts/actions';

const initialForm = {
  contractId: '',
  requiredClauses: '',
  reviewStatus: 'pending',
  findings: '',
  approvalStatus: 'pending',
  reviewer: '',
  reviewDate: '',
};

export default function AddContractComplianceForm({ contracts }: { contracts: Array<{ id: string; contract_number: string; contract_title: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await upsertContractCompliance({
      contractId: form.contractId,
      requiredClauses: form.requiredClauses.split(',').map((s) => s.trim()).filter(Boolean),
      reviewStatus: form.reviewStatus,
      findings: form.findings || undefined,
      approvalStatus: form.approvalStatus,
      reviewer: form.reviewer || undefined,
      reviewDate: form.reviewDate || undefined,
    });
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to save contract compliance record.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> Add Contract Compliance Record
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">Add Contract Compliance Record</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="contractId">Contract</label>
          <select id="contractId" value={form.contractId} onChange={(e) => setForm((p) => ({ ...p, contractId: e.target.value }))} required className={inputClass}>
            <option value="">Select a contract</option>
            {contracts.map((c) => <option key={c.id} value={c.id}>{c.contract_number} — {c.contract_title}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="reviewStatus">Review Status</label>
          <select id="reviewStatus" value={form.reviewStatus} onChange={(e) => setForm((p) => ({ ...p, reviewStatus: e.target.value }))} className={inputClass}>
            {CONTRACT_REVIEW_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="approvalStatus">Approval</label>
          <select id="approvalStatus" value={form.approvalStatus} onChange={(e) => setForm((p) => ({ ...p, approvalStatus: e.target.value }))} className={inputClass}>
            {CONTRACT_APPROVAL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="reviewer">Reviewer</label>
          <input id="reviewer" value={form.reviewer} onChange={(e) => setForm((p) => ({ ...p, reviewer: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="reviewDate">Review Date</label>
          <input id="reviewDate" type="date" value={form.reviewDate} onChange={(e) => setForm((p) => ({ ...p, reviewDate: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="requiredClauses">Required Clauses (comma-separated)</label>
          <input id="requiredClauses" value={form.requiredClauses} onChange={(e) => setForm((p) => ({ ...p, requiredClauses: e.target.value }))} placeholder="Data Protection, Termination, Indemnity" className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="findings">Findings</label>
          <textarea id="findings" value={form.findings} onChange={(e) => setForm((p) => ({ ...p, findings: e.target.value }))} rows={2} className={inputClass} />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button type="submit" disabled={submitting} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {submitting ? 'Saving...' : 'Save Record'}
      </button>
    </form>
  );
}
