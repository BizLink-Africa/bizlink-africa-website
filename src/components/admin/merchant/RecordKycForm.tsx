'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { recordKycCoordination } from '@/app/admin/(protected)/merchant-operations/kyc/actions';
import { MERCHANT_KYC_STAGES, MERCHANT_KYC_PARTNER_DECISIONS } from '@/data/merchantOperations';

export default function RecordKycForm({ merchants }: { merchants: { id: string; business_name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [merchantId, setMerchantId] = useState('');
  const [stage, setStage] = useState<'submitted_to_partner' | 'partner_response_received'>('submitted_to_partner');
  const [partnerDecision, setPartnerDecision] = useState('');
  const [partnerReference, setPartnerReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantId) {
      setError('Select a merchant.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await recordKycCoordination(merchantId, { stage, partnerDecision: partnerDecision || undefined, partnerReference, notes });
    setSubmitting(false);
    if (!result.success) {
      setError(result.message ?? 'Failed to record KYC coordination.');
      return;
    }
    setOpen(false);
    setPartnerDecision('');
    setPartnerReference('');
    setNotes('');
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> Record KYC Coordination
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">Record KYC Coordination</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>
      <p className="text-xs text-[#707975]">
        This records what was submitted to, or received back from, the approved payment infrastructure partner.
        Final KYC approval is always the partner&apos;s decision, being logged here — not a decision BizLink makes.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="merchantId">Merchant</label>
          <select id="merchantId" value={merchantId} onChange={(e) => setMerchantId(e.target.value)} required className={inputClass}>
            <option value="">Select a merchant</option>
            {merchants.map((m) => <option key={m.id} value={m.id}>{m.business_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="stage">Stage</label>
          <select id="stage" value={stage} onChange={(e) => setStage(e.target.value as typeof stage)} className={inputClass}>
            {MERCHANT_KYC_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        {stage === 'partner_response_received' && (
          <div>
            <label className={labelClass} htmlFor="partnerDecision">Partner Decision</label>
            <select id="partnerDecision" value={partnerDecision} onChange={(e) => setPartnerDecision(e.target.value)} className={inputClass}>
              <option value="">Select</option>
              {MERCHANT_KYC_PARTNER_DECISIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className={labelClass} htmlFor="partnerReference">Partner Reference</label>
          <input id="partnerReference" value={partnerReference} onChange={(e) => setPartnerReference(e.target.value)} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="notes">Notes</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputClass} resize-none`} />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Recording…' : 'Record'}
      </button>
    </form>
  );
}
