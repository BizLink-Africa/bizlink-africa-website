'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createMerchantApplication } from '@/app/admin/(protected)/merchant-operations/actions';
import { MERCHANT_REGISTRATION_TYPES, MERCHANT_EXPECTED_VOLUME_RANGES } from '@/data/merchantOperations';

const initialForm = {
  businessName: '',
  tradingName: '',
  registrationType: '',
  tin: '',
  licenceNumber: '',
  businessCategory: '',
  contactPersonName: '',
  contactPhone: '',
  contactEmail: '',
  businessAddress: '',
  expectedVolume: '',
};

export default function AddMerchantForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createMerchantApplication(form);
    setSubmitting(false);

    if (result.success && result.id) {
      router.push(`/admin/merchant-operations/profiles/${result.id}`);
    } else {
      setError(result.message ?? 'Failed to create merchant application.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> New Merchant Application
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">New Merchant Application</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

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
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="businessAddress">Business Address</label>
          <input id="businessAddress" name="businessAddress" value={form.businessAddress} onChange={handleChange} className={inputClass} />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Creating...' : 'Create Application'}
      </button>
    </form>
  );
}
