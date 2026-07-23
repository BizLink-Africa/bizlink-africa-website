'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { APPROVAL_CATEGORIES, type ApprovalWorkflow } from '@/data/approvalWorkflows';
import { createApprovalRequest } from '@/app/admin/(protected)/governance/approval-workflows/actions';

const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

export default function RaiseApprovalRequestForm({ workflows }: { workflows: ApprovalWorkflow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(APPROVAL_CATEGORIES[0].value);
  const [subjectLabel, setSubjectLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchingWorkflow = workflows.find((w) => w.category === category && w.is_active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createApprovalRequest({
      category,
      workflowId: matchingWorkflow?.id,
      subjectLabel,
      amount: amount ? Number(amount) : undefined,
    });
    setSubmitting(false);

    if (result.success) {
      setSubjectLabel('');
      setAmount('');
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to raise approval request.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> Raise Approval Request
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">New Approval Request</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass} htmlFor="ar-category">Category</label>
          <select id="ar-category" value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className={inputClass}>
            {APPROVAL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="ar-subject">What needs approval</label>
          <input id="ar-subject" value={subjectLabel} onChange={(e) => setSubjectLabel(e.target.value)} required className={inputClass} placeholder="e.g. Invoice #INV-0042" />
        </div>
        <div>
          <label className={labelClass} htmlFor="ar-amount">Amount (optional)</label>
          <input id="ar-amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
        </div>
        <div className="sm:col-span-2 flex items-end pb-2.5 text-xs text-[#707975]">
          {matchingWorkflow ? `Routes to: ${matchingWorkflow.name}` : 'No active workflow configured for this category yet.'}
        </div>
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Submitting...' : 'Submit Request'}
      </button>
    </form>
  );
}
