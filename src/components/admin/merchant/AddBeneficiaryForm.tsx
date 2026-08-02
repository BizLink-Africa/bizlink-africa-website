'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { requestBeneficiaryChange } from '@/app/admin/(protected)/merchant-operations/beneficiaries/actions';
import { MERCHANT_BENEFICIARY_TYPES } from '@/data/merchantOperations';

// Proposes an 'add' or 'change' — the destination value is never stored in
// component state longer than needed to submit, never logged, and this
// input is never populated from (or written to) localStorage/the URL.
export default function AddBeneficiaryForm({
  merchantId,
  mode = 'add',
  beneficiaryId,
  onSubmitted,
}: {
  merchantId: string;
  mode?: 'add' | 'change';
  beneficiaryId?: string;
  onSubmitted?: () => void;
}) {
  const [open, setOpen] = useState(mode === 'change');
  const [destinationType, setDestinationType] = useState('bank_account');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankOrNetworkName, setBankOrNetworkName] = useState('');
  const [bankOrNetworkCode, setBankOrNetworkCode] = useState('');
  const [destinationValue, setDestinationValue] = useState('');
  const [isPrimary, setIsPrimary] = useState(mode === 'add');
  const [changeReason, setChangeReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await requestBeneficiaryChange({
      merchantId,
      beneficiaryId,
      requestType: mode,
      destinationType,
      accountHolderName,
      bankOrNetworkName,
      bankOrNetworkCode,
      destinationValue,
      isPrimary,
      changeReason,
    });
    setSubmitting(false);

    if (!result.success) {
      setError(result.message ?? 'Failed to submit the request.');
      return;
    }

    setAccountHolderName('');
    setBankOrNetworkName('');
    setBankOrNetworkCode('');
    setDestinationValue('');
    setChangeReason('');
    if (mode === 'add') setOpen(false);
    onSubmitted?.();
  };

  if (mode === 'add' && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> Propose New Beneficiary
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-4" autoComplete="off">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">{mode === 'add' ? 'Propose New Beneficiary' : 'Propose Beneficiary Change'}</h2>
        {mode === 'add' && (
          <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
            <X size={18} />
          </button>
        )}
      </div>
      <p className="text-xs text-[#707975]">
        This creates a proposal only — a different staff member with approval permission must review and approve it
        before it takes effect. A cooling period applies after approval.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="destinationType">Type</label>
          <select id="destinationType" value={destinationType} onChange={(e) => setDestinationType(e.target.value)} className={inputClass}>
            {MERCHANT_BENEFICIARY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="accountHolderName">Account Holder Name</label>
          <input id="accountHolderName" value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} required className={inputClass} autoComplete="off" />
        </div>
        <div>
          <label className={labelClass} htmlFor="bankOrNetworkName">Bank / Network Name</label>
          <input id="bankOrNetworkName" value={bankOrNetworkName} onChange={(e) => setBankOrNetworkName(e.target.value)} className={inputClass} autoComplete="off" />
        </div>
        <div>
          <label className={labelClass} htmlFor="bankOrNetworkCode">Bank / Network Code</label>
          <input id="bankOrNetworkCode" value={bankOrNetworkCode} onChange={(e) => setBankOrNetworkCode(e.target.value)} className={inputClass} autoComplete="off" />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="destinationValue">Account / Wallet Number</label>
          <input
            id="destinationValue"
            type="password"
            value={destinationValue}
            onChange={(e) => setDestinationValue(e.target.value)}
            required
            className={inputClass}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="sm:col-span-2 flex items-center gap-2">
          <input id="isPrimary" type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="accent-[#00342b]" />
          <label htmlFor="isPrimary" className="text-sm text-[#1b1c1c]">Set as primary settlement destination</label>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="changeReason">Reason</label>
          <textarea id="changeReason" value={changeReason} onChange={(e) => setChangeReason(e.target.value)} rows={2} required className={`${inputClass} resize-none`} />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Submitting…' : 'Submit for Approval'}
      </button>
    </form>
  );
}
