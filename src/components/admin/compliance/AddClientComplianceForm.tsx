'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { CLIENT_COMPLIANCE_STATUSES } from '@/data/clientCompliance';
import { RISK_LEVELS } from '@/data/compliance';
import { upsertClientCompliance } from '@/app/admin/(protected)/compliance/clients/actions';

const initialForm = {
  clientId: '',
  complianceStatus: 'pending',
  documentsReceived: '',
  documentsPending: '',
  reviewDate: '',
  nextReviewDate: '',
  riskLevel: 'low',
  notes: '',
};

export default function AddClientComplianceForm({ clients }: { clients: Array<{ id: string; client_name: string; business_name: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await upsertClientCompliance({
      clientId: form.clientId,
      complianceStatus: form.complianceStatus,
      documentsReceived: form.documentsReceived.split(',').map((s) => s.trim()).filter(Boolean),
      documentsPending: form.documentsPending.split(',').map((s) => s.trim()).filter(Boolean),
      reviewDate: form.reviewDate || undefined,
      nextReviewDate: form.nextReviewDate || undefined,
      riskLevel: form.riskLevel,
      notes: form.notes || undefined,
    });
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to save client compliance record.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> Add Client Compliance Record
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">Add Client Compliance Record</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="clientId">Client</label>
          <select id="clientId" value={form.clientId} onChange={(e) => setForm((p) => ({ ...p, clientId: e.target.value }))} required className={inputClass}>
            <option value="">Select a client</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.client_name} — {c.business_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="complianceStatus">Compliance Status</label>
          <select id="complianceStatus" value={form.complianceStatus} onChange={(e) => setForm((p) => ({ ...p, complianceStatus: e.target.value }))} className={inputClass}>
            {CLIENT_COMPLIANCE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="riskLevel">Risk Level</label>
          <select id="riskLevel" value={form.riskLevel} onChange={(e) => setForm((p) => ({ ...p, riskLevel: e.target.value }))} className={inputClass}>
            {RISK_LEVELS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="reviewDate">Review Date</label>
          <input id="reviewDate" type="date" value={form.reviewDate} onChange={(e) => setForm((p) => ({ ...p, reviewDate: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="nextReviewDate">Next Review Date</label>
          <input id="nextReviewDate" type="date" value={form.nextReviewDate} onChange={(e) => setForm((p) => ({ ...p, nextReviewDate: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="documentsReceived">Documents Received (comma-separated)</label>
          <input id="documentsReceived" value={form.documentsReceived} onChange={(e) => setForm((p) => ({ ...p, documentsReceived: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="documentsPending">Documents Pending (comma-separated)</label>
          <input id="documentsPending" value={form.documentsPending} onChange={(e) => setForm((p) => ({ ...p, documentsPending: e.target.value }))} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="notes">Notes</label>
          <textarea id="notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} className={inputClass} />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button type="submit" disabled={submitting} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {submitting ? 'Saving...' : 'Save Record'}
      </button>
    </form>
  );
}
