'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateOnboardingCaseDetails } from '@/app/admin/(protected)/onboarding/pipeline/actions';
import StaffPicker, { type StaffOption } from '@/components/admin/crm/StaffPicker';
import { ONBOARDING_PRIORITIES, type OnboardingPriority } from '@/data/operations';

interface RelatedOption {
  id: string;
  label: string;
}

export default function OnboardingCaseDetailForm({
  id,
  initialPriority,
  initialAssignedUserId,
  initialDueDate,
  initialNotes,
  initialBlockers,
  initialDocumentReferences,
  initialRelatedContractId,
  initialRelatedProformaId,
  initialRelatedInvoiceId,
  staff,
  contracts,
  proformas,
  invoices,
}: {
  id: string;
  initialPriority: OnboardingPriority;
  initialAssignedUserId: string;
  initialDueDate: string;
  initialNotes: string;
  initialBlockers: string;
  initialDocumentReferences: string[];
  initialRelatedContractId: string;
  initialRelatedProformaId: string;
  initialRelatedInvoiceId: string;
  staff: StaffOption[];
  contracts: RelatedOption[];
  proformas: RelatedOption[];
  invoices: RelatedOption[];
}) {
  const router = useRouter();
  const [priority, setPriority] = useState(initialPriority);
  const [assignedUserId, setAssignedUserId] = useState(initialAssignedUserId);
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [notes, setNotes] = useState(initialNotes);
  const [blockers, setBlockers] = useState(initialBlockers);
  const [documentReferences, setDocumentReferences] = useState(initialDocumentReferences.join('\n'));
  const [relatedContractId, setRelatedContractId] = useState(initialRelatedContractId);
  const [relatedProformaId, setRelatedProformaId] = useState(initialRelatedProformaId);
  const [relatedInvoiceId, setRelatedInvoiceId] = useState(initialRelatedInvoiceId);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await updateOnboardingCaseDetails(id, {
      priority,
      assignedUserId: assignedUserId || undefined,
      dueDate: dueDate || undefined,
      notes: notes || undefined,
      blockers: blockers || undefined,
      documentReferences: documentReferences.split('\n'),
      relatedContractId: relatedContractId || undefined,
      relatedProformaId: relatedProformaId || undefined,
      relatedInvoiceId: relatedInvoiceId || undefined,
    });
    setSaving(false);
    if (result.success) {
      setFeedback({ type: 'success', text: 'Saved.' });
      router.refresh();
    } else {
      setFeedback({ type: 'error', text: result.message ?? 'Failed to save.' });
    }
  };

  return (
    <div className="bg-white border border-[#bfc9c4] p-6 space-y-4">
      <h2 className="font-semibold text-[#00342b]">Case Details</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="priority">Priority</label>
          <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value as OnboardingPriority)} className={inputClass}>
            {ONBOARDING_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="assignedUserId">Assigned Staff</label>
          <StaffPicker id="assignedUserId" value={assignedUserId} onChange={setAssignedUserId} staff={staff} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="dueDate">Due Date</label>
          <input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="relatedContractId">Related Contract</label>
          <select id="relatedContractId" value={relatedContractId} onChange={(e) => setRelatedContractId(e.target.value)} className={inputClass}>
            <option value="">None</option>
            {contracts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="relatedProformaId">Related Proforma</label>
          <select id="relatedProformaId" value={relatedProformaId} onChange={(e) => setRelatedProformaId(e.target.value)} className={inputClass}>
            <option value="">None</option>
            {proformas.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="relatedInvoiceId">Related Invoice</label>
          <select id="relatedInvoiceId" value={relatedInvoiceId} onChange={(e) => setRelatedInvoiceId(e.target.value)} className={inputClass}>
            <option value="">None</option>
            {invoices.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="documentReferences">Document References (one per line — file name, link, or description)</label>
          <textarea id="documentReferences" rows={3} value={documentReferences} onChange={(e) => setDocumentReferences(e.target.value)} className={`${inputClass} resize-none`} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="blockers">Blockers</label>
          <textarea id="blockers" rows={2} value={blockers} onChange={(e) => setBlockers(e.target.value)} className={`${inputClass} resize-none`} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="notes">Notes</label>
          <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} resize-none`} />
        </div>
      </div>
      {feedback && (
        <p className={`text-sm px-3 py-2 border ${feedback.type === 'success' ? 'text-[#00342b] bg-[#e0f2ee] border-[#afefdd]' : 'text-red-700 bg-red-50 border-red-200'}`}>
          {feedback.text}
        </p>
      )}
      <button onClick={handleSave} disabled={saving} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}
