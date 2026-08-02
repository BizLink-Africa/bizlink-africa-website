'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search } from 'lucide-react';
import { lookupBeneficiaryAccount, confirmLookupNameMatch } from '@/app/admin/(protected)/merchant-operations/beneficiaries/lookup-actions';
import { requestBeneficiaryChange } from '@/app/admin/(protected)/merchant-operations/beneficiaries/actions';
import { SELCOM_INSTITUTION_CATEGORIES, type SelcomInstitutionCode } from '@/data/merchantOperations';

interface LookupResultState {
  lookupId: string;
  maskedAccount: string;
  returnedAccountName: string | null;
  totalCharges: number | null;
}

// Runs a live Selcom account lookup (GET /v1/account/lookup) through
// protected server-side code only — this component never sees Selcom
// credentials, and the raw account/wallet number the user types here is
// sent straight to the server action and never round-tripped back or
// stored in this component's state beyond the single request that needs
// it. Works both standalone (beneficiaryId omitted — pre-add lookups) and
// per-beneficiary (re-verification of an existing beneficiary).
export default function AccountLookupPanel({
  merchantId,
  beneficiaryId,
  institutionCodes,
  canLookup,
  triggerLabel = 'Look Up Account',
}: {
  merchantId: string;
  beneficiaryId?: string;
  institutionCodes: SelcomInstitutionCode[];
  canLookup: boolean;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<'bank' | 'mobile_wallet' | 'selcom_internal'>('bank');
  const [institutionCode, setInstitutionCode] = useState('');
  const [account, setAccount] = useState('');
  const [amount, setAmount] = useState('');

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResultState | null>(null);

  const [reviewPending, setReviewPending] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [nameMatchConfirmed, setNameMatchConfirmed] = useState<boolean | null>(null);

  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifySubmitted, setVerifySubmitted] = useState(false);

  const codesForCategory = useMemo(() => institutionCodes.filter((c) => c.category === category), [institutionCodes, category]);

  if (!canLookup) return null;

  function resetResultState() {
    setResult(null);
    setNameMatchConfirmed(null);
    setReviewNotes('');
    setVerifySubmitted(false);
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    resetResultState();

    const lookupResult = await lookupBeneficiaryAccount({
      merchantId,
      beneficiaryId,
      institutionCode,
      account,
      amount: amount || undefined,
    });
    setPending(false);
    // Never keep the typed account number in memory longer than the
    // request needs it for.
    setAccount('');

    if (!lookupResult.success) {
      setError(lookupResult.message ?? 'Account lookup failed.');
      return;
    }

    setResult({
      lookupId: lookupResult.lookupId!,
      maskedAccount: lookupResult.maskedAccount!,
      returnedAccountName: lookupResult.returnedAccountName ?? null,
      totalCharges: lookupResult.totalCharges ?? null,
    });
  }

  async function handleNameMatchReview(confirmed: boolean) {
    if (!result) return;
    setReviewPending(true);
    setError(null);
    const reviewResult = await confirmLookupNameMatch(result.lookupId, confirmed, reviewNotes, merchantId);
    setReviewPending(false);
    if (!reviewResult.success) {
      setError(reviewResult.message ?? 'Failed to record the review.');
      return;
    }
    setNameMatchConfirmed(confirmed);
  }

  async function handleSubmitForVerification() {
    if (!result || !beneficiaryId) return;
    setVerifySubmitting(true);
    setError(null);
    const submitResult = await requestBeneficiaryChange({
      merchantId,
      beneficiaryId,
      requestType: 'verify',
      verificationMethod: 'selcom_account_lookup',
      changeReason: `Selcom account lookup ${result.maskedAccount} — returned name reviewed and confirmed as a match.`,
      lookupId: result.lookupId,
    });
    setVerifySubmitting(false);
    if (!submitResult.success) {
      setError(submitResult.message ?? 'Failed to submit for verification.');
      return;
    }
    setVerifySubmitted(true);
    router.refresh();
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors"
      >
        <Search size={12} /> {triggerLabel}
      </button>
    );
  }

  return (
    <div className="border border-[#bfc9c4] bg-[#fbf9f8] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-[#00342b]">Selcom Account Lookup</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-[#707975] hover:text-[#00342b]">Close</button>
      </div>
      <p className="text-xs text-[#707975]">
        Confirms an account/wallet holder name directly with Selcom before it is used. This never verifies a
        beneficiary by itself — the returned name must be reviewed, and verification still requires separate
        maker-checker approval.
      </p>

      <form onSubmit={handleLookup} className="grid grid-cols-1 sm:grid-cols-2 gap-3" autoComplete="off">
        <div>
          <label className={labelClass} htmlFor={`lookup-category-${beneficiaryId ?? 'new'}`}>Category</label>
          <select
            id={`lookup-category-${beneficiaryId ?? 'new'}`}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as typeof category);
              setInstitutionCode('');
            }}
            className={inputClass}
          >
            {SELCOM_INSTITUTION_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor={`lookup-institution-${beneficiaryId ?? 'new'}`}>Institution</label>
          <select
            id={`lookup-institution-${beneficiaryId ?? 'new'}`}
            value={institutionCode}
            onChange={(e) => setInstitutionCode(e.target.value)}
            required
            className={inputClass}
          >
            <option value="">Select…</option>
            {codesForCategory.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor={`lookup-account-${beneficiaryId ?? 'new'}`}>Account / Wallet Number</label>
          <input
            id={`lookup-account-${beneficiaryId ?? 'new'}`}
            type="password"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            required
            className={inputClass}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor={`lookup-amount-${beneficiaryId ?? 'new'}`}>Amount (optional)</label>
          <input
            id={`lookup-amount-${beneficiaryId ?? 'new'}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 50000.00"
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            {pending ? 'Looking up…' : 'Run Lookup'}
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      {result && (
        <div className="bg-white border border-[#bfc9c4] p-4 space-y-3">
          <p className="text-sm text-[#1b7a3d] bg-green-50 border border-green-200 px-3 py-2">
            Lookup {result.lookupId ? 'succeeded' : ''} — reference recorded. Account: {result.maskedAccount}
            {result.totalCharges !== null && ` · Charges: ${result.totalCharges}`}
          </p>
          <div>
            <p className={labelClass}>Returned Account Holder Name</p>
            <p className="text-sm font-semibold text-[#1b1c1c]">{result.returnedAccountName ?? '— none returned —'}</p>
          </div>

          {nameMatchConfirmed === null ? (
            <div className="space-y-2">
              <label className={labelClass} htmlFor={`lookup-review-notes-${result.lookupId}`}>
                Does this name match the merchant or authorised beneficiary? (required review)
              </label>
              <input
                id={`lookup-review-notes-${result.lookupId}`}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Optional notes"
                className={inputClass}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={reviewPending}
                  onClick={() => handleNameMatchReview(true)}
                  className="text-xs font-medium text-white bg-[#1b7a3d] px-3 py-1.5 hover:bg-[#166030] transition-colors disabled:opacity-60"
                >
                  {reviewPending ? 'Saving…' : 'Confirm Name Matches'}
                </button>
                <button
                  type="button"
                  disabled={reviewPending}
                  onClick={() => handleNameMatchReview(false)}
                  className="text-xs font-medium text-[#8a1f1f] border border-[#8a1f1f] px-3 py-1.5 hover:bg-[#8a1f1f] hover:text-white transition-colors disabled:opacity-60"
                >
                  Does Not Match
                </button>
              </div>
            </div>
          ) : nameMatchConfirmed ? (
            <div className="space-y-2">
              <p className="text-xs text-[#1b7a3d] font-medium">✓ Name match confirmed by reviewer.</p>
              {beneficiaryId && !verifySubmitted && (
                <button
                  type="button"
                  disabled={verifySubmitting}
                  onClick={handleSubmitForVerification}
                  className="text-xs font-medium text-white bg-[#00342b] px-3 py-1.5 hover:bg-[#004d40] transition-colors disabled:opacity-60"
                >
                  {verifySubmitting ? 'Submitting…' : 'Submit for Verification (maker)'}
                </button>
              )}
              {verifySubmitted && (
                <p className="text-xs text-[#1b7a3d] bg-green-50 border border-green-200 px-3 py-2">
                  Submitted for verification — a different staff member with approval permission must still review
                  and approve it before this beneficiary becomes verified.
                </p>
              )}
              {!beneficiaryId && (
                <p className="text-xs text-[#707975]">
                  This was a pre-add lookup with no beneficiary on file yet — use &quot;Propose New Beneficiary&quot;
                  below to add one, then verify it from this evidence.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-[#8a1f1f] font-medium">✗ Reviewer recorded this as not matching. This lookup cannot support a verification.</p>
          )}
        </div>
      )}
    </div>
  );
}
