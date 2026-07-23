'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveSensitiveDetails, type SensitiveDetailsInput } from '@/app/admin/(protected)/contracts/actions';
import type { ContractSensitiveDetails } from '@/data/contracts';

export default function SensitiveDetailsForm({
  contractId,
  existing,
  readOnly,
}: {
  contractId: string;
  existing: ContractSensitiveDetails | null;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    tin: existing?.tin ?? '',
    tinRegistrationDate: existing?.tin_registration_date ?? '',
    nida: existing?.nida ?? '',
    businessLicenceNumber: existing?.business_licence_number ?? '',
    businessLicenceExpiryDate: existing?.business_licence_expiry_date ?? '',
    monthlyTurnover: existing?.monthly_turnover ?? 0,
    dailyCashCollection: existing?.daily_cash_collection ?? 0,
    usesMobileMoney: existing?.uses_mobile_money ?? false,
    mobileMoneyProviders: existing?.mobile_money_providers ?? '',
    dailyMobileMoneyCollection: existing?.daily_mobile_money_collection ?? 0,
    usesPos: existing?.uses_pos ?? false,
    posProviderName: existing?.pos_provider_name ?? '',
    dailyPosCollection: existing?.daily_pos_collection ?? 0,
    internationalCardAcceptanceReason: existing?.international_card_acceptance_reason ?? '',
    bankName: existing?.bank_name ?? '',
    bankBranch: existing?.bank_branch ?? '',
    bankAccountName: existing?.bank_account_name ?? '',
    bankAccountNumber: existing?.bank_account_number ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const result = await saveSensitiveDetails(contractId, form as SensitiveDetailsInput);
    setSubmitting(false);

    if (result.success) {
      setSuccess(true);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to save details.');
    }
  };

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none disabled:bg-[#f5f3f3] disabled:text-[#707975]';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="tin">TIN</label>
          <input id="tin" disabled={readOnly} value={form.tin} onChange={(e) => setForm((p) => ({ ...p, tin: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="tinRegistrationDate">TIN Registration Date</label>
          <input id="tinRegistrationDate" type="date" disabled={readOnly} value={form.tinRegistrationDate} onChange={(e) => setForm((p) => ({ ...p, tinRegistrationDate: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="nida">NIDA (National ID)</label>
          <input id="nida" disabled={readOnly} value={form.nida} onChange={(e) => setForm((p) => ({ ...p, nida: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="businessLicenceNumber">Business Licence Number</label>
          <input id="businessLicenceNumber" disabled={readOnly} value={form.businessLicenceNumber} onChange={(e) => setForm((p) => ({ ...p, businessLicenceNumber: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="businessLicenceExpiryDate">Business Licence Expiry Date</label>
          <input id="businessLicenceExpiryDate" type="date" disabled={readOnly} value={form.businessLicenceExpiryDate} onChange={(e) => setForm((p) => ({ ...p, businessLicenceExpiryDate: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="monthlyTurnover">Monthly Turnover</label>
          <input id="monthlyTurnover" type="number" min={0} disabled={readOnly} value={form.monthlyTurnover} onChange={(e) => setForm((p) => ({ ...p, monthlyTurnover: Number(e.target.value) || 0 }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="dailyCashCollection">Daily Cash Collection</label>
          <input id="dailyCashCollection" type="number" min={0} disabled={readOnly} value={form.dailyCashCollection} onChange={(e) => setForm((p) => ({ ...p, dailyCashCollection: Number(e.target.value) || 0 }))} className={inputClass} />
        </div>

        <div className="sm:col-span-2 flex items-center gap-6 py-1">
          <label className="flex items-center gap-2 text-sm text-[#1b1c1c] cursor-pointer">
            <input type="checkbox" disabled={readOnly} checked={form.usesMobileMoney} onChange={(e) => setForm((p) => ({ ...p, usesMobileMoney: e.target.checked }))} className="accent-[#00342b]" />
            Uses Mobile Money for collections
          </label>
          <label className="flex items-center gap-2 text-sm text-[#1b1c1c] cursor-pointer">
            <input type="checkbox" disabled={readOnly} checked={form.usesPos} onChange={(e) => setForm((p) => ({ ...p, usesPos: e.target.checked }))} className="accent-[#00342b]" />
            Uses bank POS for collections
          </label>
        </div>

        {form.usesMobileMoney && (
          <>
            <div>
              <label className={labelClass} htmlFor="mobileMoneyProviders">Mobile Money Providers Used</label>
              <input id="mobileMoneyProviders" disabled={readOnly} value={form.mobileMoneyProviders} onChange={(e) => setForm((p) => ({ ...p, mobileMoneyProviders: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="dailyMobileMoneyCollection">Daily Mobile Money Collections</label>
              <input id="dailyMobileMoneyCollection" type="number" min={0} disabled={readOnly} value={form.dailyMobileMoneyCollection} onChange={(e) => setForm((p) => ({ ...p, dailyMobileMoneyCollection: Number(e.target.value) || 0 }))} className={inputClass} />
            </div>
          </>
        )}
        {form.usesPos && (
          <>
            <div>
              <label className={labelClass} htmlFor="posProviderName">Bank / POS Provider Name</label>
              <input id="posProviderName" disabled={readOnly} value={form.posProviderName} onChange={(e) => setForm((p) => ({ ...p, posProviderName: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="dailyPosCollection">Daily POS Collections</label>
              <input id="dailyPosCollection" type="number" min={0} disabled={readOnly} value={form.dailyPosCollection} onChange={(e) => setForm((p) => ({ ...p, dailyPosCollection: Number(e.target.value) || 0 }))} className={inputClass} />
            </div>
          </>
        )}

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="internationalCardAcceptanceReason">Reason for International Card Acceptance</label>
          <input id="internationalCardAcceptanceReason" disabled={readOnly} value={form.internationalCardAcceptanceReason} onChange={(e) => setForm((p) => ({ ...p, internationalCardAcceptanceReason: e.target.value }))} className={inputClass} />
        </div>

        <p className="sm:col-span-2 text-xs font-semibold text-[#00342b] uppercase tracking-wider pt-3 border-t border-[#e5e5e5]">Bank Details</p>
        <div>
          <label className={labelClass} htmlFor="bankName">Bank Name</label>
          <input id="bankName" disabled={readOnly} value={form.bankName} onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="bankBranch">Bank Branch</label>
          <input id="bankBranch" disabled={readOnly} value={form.bankBranch} onChange={(e) => setForm((p) => ({ ...p, bankBranch: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="bankAccountName">Account Name</label>
          <input id="bankAccountName" disabled={readOnly} value={form.bankAccountName} onChange={(e) => setForm((p) => ({ ...p, bankAccountName: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="bankAccountNumber">Account Number</label>
          <input id="bankAccountNumber" disabled={readOnly} value={form.bankAccountNumber} onChange={(e) => setForm((p) => ({ ...p, bankAccountNumber: e.target.value }))} className={inputClass} />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
      {success && <p className="text-sm text-[#1b7a3d] bg-[#dcf5e3] border border-[#bfe5cc] px-3 py-2">Saved.</p>}

      {!readOnly && (
        <button
          type="submit"
          disabled={submitting}
          className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
        >
          {submitting ? 'Saving...' : 'Save Details'}
        </button>
      )}
    </form>
  );
}
