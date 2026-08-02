'use client';

import { useState } from 'react';
import { updateMerchantProfile } from '@/app/admin/(protected)/merchant-operations/actions';
import { MERCHANT_REGISTRATION_TYPES, MERCHANT_EXPECTED_VOLUME_RANGES, MERCHANT_RISK_STATUSES, type Merchant } from '@/data/merchantOperations';

export default function MerchantEditForm({ merchant }: { merchant: Merchant }) {
  const [form, setForm] = useState({
    businessName: merchant.business_name,
    tradingName: merchant.trading_name ?? '',
    registrationType: merchant.registration_type ?? '',
    tin: merchant.tin ?? '',
    licenceNumber: merchant.licence_number ?? '',
    businessCategory: merchant.business_category ?? '',
    contactPersonName: merchant.contact_person_name ?? '',
    contactPhone: merchant.contact_phone ?? '',
    contactEmail: merchant.contact_email ?? '',
    businessAddress: merchant.business_address ?? '',
    expectedVolume: merchant.expected_volume ?? '',
    riskStatus: merchant.risk_status,
    partnerMerchantReference: merchant.partner_merchant_reference ?? '',
    tillReference: merchant.till_reference ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const result = await updateMerchantProfile(merchant.id, form);
    setSubmitting(false);
    setMessage(
      result.success
        ? { type: 'success', text: 'Profile updated.' }
        : { type: 'error', text: result.message ?? 'Failed to update profile.' }
    );
  };

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="businessName">Legal Business Name</label>
          <input id="businessName" name="businessName" value={form.businessName} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="tradingName">Trading Name</label>
          <input id="tradingName" name="tradingName" value={form.tradingName} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="registrationType">Registration Type</label>
          <select id="registrationType" name="registrationType" value={form.registrationType} onChange={handleChange} className={inputClass}>
            <option value="">Select</option>
            {MERCHANT_REGISTRATION_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="businessCategory">Business Category</label>
          <input id="businessCategory" name="businessCategory" value={form.businessCategory} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="tin">TIN</label>
          <input id="tin" name="tin" value={form.tin} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="licenceNumber">Licence Number</label>
          <input id="licenceNumber" name="licenceNumber" value={form.licenceNumber} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="contactPersonName">Contact Person</label>
          <input id="contactPersonName" name="contactPersonName" value={form.contactPersonName} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="contactPhone">Phone</label>
          <input id="contactPhone" name="contactPhone" value={form.contactPhone} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="contactEmail">Email</label>
          <input id="contactEmail" name="contactEmail" type="email" value={form.contactEmail} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="expectedVolume">Expected Volume</label>
          <select id="expectedVolume" name="expectedVolume" value={form.expectedVolume} onChange={handleChange} className={inputClass}>
            <option value="">Select</option>
            {MERCHANT_EXPECTED_VOLUME_RANGES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="riskStatus">Risk Status</label>
          <select id="riskStatus" name="riskStatus" value={form.riskStatus} onChange={handleChange} className={inputClass}>
            {MERCHANT_RISK_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="businessAddress">Business Address</label>
          <input id="businessAddress" name="businessAddress" value={form.businessAddress} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="partnerMerchantReference">Partner Merchant Reference</label>
          <input id="partnerMerchantReference" name="partnerMerchantReference" value={form.partnerMerchantReference} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="tillReference">Till/Payment-Account Reference</label>
          <input id="tillReference" name="tillReference" value={form.tillReference} onChange={handleChange} className={inputClass} />
        </div>
      </div>

      {message && (
        <p className={`text-sm px-3 py-2 border ${message.type === 'success' ? 'text-[#1b7a3d] bg-[#dcf5e3] border-[#b7e3c4]' : 'text-red-700 bg-red-50 border-red-200'}`}>
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Save Changes'}
      </button>
    </form>
  );
}
