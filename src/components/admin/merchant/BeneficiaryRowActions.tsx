'use client';

import { useState } from 'react';
import { requestBeneficiaryChange } from '@/app/admin/(protected)/merchant-operations/beneficiaries/actions';
import { MERCHANT_BENEFICIARY_VERIFICATION_METHODS, type SelcomInstitutionCode } from '@/data/merchantOperations';
import AddBeneficiaryForm from './AddBeneficiaryForm';
import AccountLookupPanel from './AccountLookupPanel';

export default function BeneficiaryRowActions({
  merchantId,
  beneficiaryId,
  canPropose,
  institutionCodes,
}: {
  merchantId: string;
  beneficiaryId: string;
  canPropose: boolean;
  institutionCodes: SelcomInstitutionCode[];
}) {
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [showVerifyForm, setShowVerifyForm] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<string>(MERCHANT_BENEFICIARY_VERIFICATION_METHODS[0].value);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canPropose) return null;

  const handleSuspend = async () => {
    const reason = window.prompt('Reason for requesting suspension (required):');
    if (!reason || !reason.trim()) return;
    setPending(true);
    setError(null);
    const result = await requestBeneficiaryChange({ merchantId, beneficiaryId, requestType: 'suspend', changeReason: reason });
    setPending(false);
    if (!result.success) setError(result.message ?? 'Failed to submit request.');
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await requestBeneficiaryChange({
      merchantId,
      beneficiaryId,
      requestType: 'verify',
      verificationMethod,
      changeReason: `Verification via ${verificationMethod}`,
    });
    setPending(false);
    if (!result.success) {
      setError(result.message ?? 'Failed to submit request.');
      return;
    }
    setShowVerifyForm(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setShowVerifyForm((v) => !v)}
          disabled={pending}
          className="text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors disabled:opacity-60"
        >
          Request Verify
        </button>
        <button
          type="button"
          onClick={() => setShowChangeForm((v) => !v)}
          disabled={pending}
          className="text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors disabled:opacity-60"
        >
          Request Change
        </button>
        <button
          type="button"
          onClick={handleSuspend}
          disabled={pending}
          className="text-xs font-medium text-[#8a1f1f] border border-[#8a1f1f] px-3 py-1.5 hover:bg-[#8a1f1f] hover:text-white transition-colors disabled:opacity-60"
        >
          Request Suspend
        </button>
      </div>

      <AccountLookupPanel
        merchantId={merchantId}
        beneficiaryId={beneficiaryId}
        institutionCodes={institutionCodes}
        canLookup={canPropose}
        triggerLabel="Look Up / Re-verify Account"
      />

      {showVerifyForm && (
        <form onSubmit={handleVerifySubmit} className="flex items-center gap-2 border border-[#bfc9c4] bg-[#fbf9f8] p-3">
          <select
            value={verificationMethod}
            onChange={(e) => setVerificationMethod(e.target.value)}
            className="border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none"
          >
            {MERCHANT_BENEFICIARY_VERIFICATION_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <button type="submit" disabled={pending} className="text-xs font-medium text-white bg-[#00342b] px-3 py-1.5 hover:bg-[#004d40] transition-colors disabled:opacity-60">
            Submit
          </button>
        </form>
      )}

      {showChangeForm && (
        <AddBeneficiaryForm merchantId={merchantId} mode="change" beneficiaryId={beneficiaryId} onSubmitted={() => setShowChangeForm(false)} />
      )}

      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
