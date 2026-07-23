'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createContract, type ContractInput } from '@/app/admin/(protected)/contracts/actions';

interface ClientOption {
  id: string;
  client_name: string;
  business_name: string;
}

const initialForm = {
  contractTitle: '',
  clientId: '',
  startDate: '',
  contractValue: 0,
  currency: 'TZS',
  paymentTerms: '',
  contractOwner: '',
  operationsOwner: '',
  renewalNoticePeriodDays: 30,
  notes: '',
  merchantAgentName: '',
  outletName: '',
  businessName: '',
  businessRegistrationNumber: '',
  mainProductsOrServices: '',
  address: '',
  city: '',
  district: '',
  ward: '',
  region: '',
  gpsLatitude: '',
  gpsLongitude: '',
  contactName: '',
  contactDesignation: '',
  contactPhone: '',
  contactEmail: '',
  notificationPhone: '',
  notificationEmail: '',
  businessType: '',
  yearOfIncorporation: '',
  yearsOfOperation: '',
};

const NUMERIC_FIELDS = new Set(['contractValue', 'renewalNoticePeriodDays', 'gpsLatitude', 'gpsLongitude', 'yearOfIncorporation', 'yearsOfOperation']);

export default function CreateContractForm({ clients, currency }: { clients: ClientOption[]; currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...initialForm, currency });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, NUMERIC_FIELDS.has(key) ? Number(value) || 0 : value])
    ) as unknown as ContractInput;

    const result = await createContract(payload);
    setSubmitting(false);

    if (result.success && result.id) {
      router.push(`/admin/contracts/${result.id}`);
    } else {
      setError(result.message ?? 'Failed to create contract.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> New Contract
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';
  const sectionClass = 'text-xs font-semibold text-[#00342b] uppercase tracking-wider pt-3 border-t border-[#e5e5e5]';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-4 max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">New Contract</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="contractTitle">Contract Title</label>
          <input id="contractTitle" name="contractTitle" value={form.contractTitle} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="clientId">Client</label>
          <select id="clientId" name="clientId" value={form.clientId} onChange={handleChange} className={inputClass}>
            <option value="">No linked client</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.client_name} — {c.business_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="contractValue">Contract Value ({form.currency})</label>
          <input id="contractValue" name="contractValue" type="number" min={0} step="0.01" value={form.contractValue} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="startDate">Start Date</label>
          <input id="startDate" name="startDate" type="date" value={form.startDate} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="renewalNoticePeriodDays">Renewal Notice Period (days)</label>
          <input id="renewalNoticePeriodDays" name="renewalNoticePeriodDays" type="number" min={0} value={form.renewalNoticePeriodDays} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="paymentTerms">Payment Terms</label>
          <input id="paymentTerms" name="paymentTerms" value={form.paymentTerms} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="contractOwner">Contract Owner</label>
          <input id="contractOwner" name="contractOwner" value={form.contractOwner} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="operationsOwner">Operations Owner</label>
          <input id="operationsOwner" name="operationsOwner" value={form.operationsOwner} onChange={handleChange} className={inputClass} />
        </div>

        <p className={`sm:col-span-2 ${sectionClass}`}>Outlet / Merchant Profile</p>
        <div>
          <label className={labelClass} htmlFor="merchantAgentName">Merchant/Agent Name</label>
          <input id="merchantAgentName" name="merchantAgentName" value={form.merchantAgentName} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="outletName">Outlet Name</label>
          <input id="outletName" name="outletName" value={form.outletName} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="businessName">Business Name</label>
          <input id="businessName" name="businessName" value={form.businessName} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="businessRegistrationNumber">Business Registration Number</label>
          <input id="businessRegistrationNumber" name="businessRegistrationNumber" value={form.businessRegistrationNumber} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="businessType">Type of Business</label>
          <input id="businessType" name="businessType" value={form.businessType} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="mainProductsOrServices">Main Products or Services</label>
          <input id="mainProductsOrServices" name="mainProductsOrServices" value={form.mainProductsOrServices} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="yearOfIncorporation">Year of Incorporation</label>
          <input id="yearOfIncorporation" name="yearOfIncorporation" type="number" value={form.yearOfIncorporation} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="yearsOfOperation">Years of Operation</label>
          <input id="yearsOfOperation" name="yearsOfOperation" type="number" value={form.yearsOfOperation} onChange={handleChange} className={inputClass} />
        </div>

        <p className={`sm:col-span-2 ${sectionClass}`}>Location</p>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="address">Address</label>
          <input id="address" name="address" value={form.address} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="city">City</label>
          <input id="city" name="city" value={form.city} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="district">District</label>
          <input id="district" name="district" value={form.district} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="ward">Ward</label>
          <input id="ward" name="ward" value={form.ward} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="region">Region</label>
          <input id="region" name="region" value={form.region} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="gpsLatitude">GPS Latitude</label>
          <input id="gpsLatitude" name="gpsLatitude" type="number" step="0.000001" value={form.gpsLatitude} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="gpsLongitude">GPS Longitude</label>
          <input id="gpsLongitude" name="gpsLongitude" type="number" step="0.000001" value={form.gpsLongitude} onChange={handleChange} className={inputClass} />
        </div>

        <p className={`sm:col-span-2 ${sectionClass}`}>Contact</p>
        <div>
          <label className={labelClass} htmlFor="contactName">Contact Name</label>
          <input id="contactName" name="contactName" value={form.contactName} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="contactDesignation">Designation</label>
          <input id="contactDesignation" name="contactDesignation" value={form.contactDesignation} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="contactPhone">Contact Phone</label>
          <input id="contactPhone" name="contactPhone" value={form.contactPhone} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="contactEmail">Contact Email</label>
          <input id="contactEmail" name="contactEmail" type="email" value={form.contactEmail} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="notificationPhone">Notification Phone</label>
          <input id="notificationPhone" name="notificationPhone" value={form.notificationPhone} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="notificationEmail">Notification Email</label>
          <input id="notificationEmail" name="notificationEmail" type="email" value={form.notificationEmail} onChange={handleChange} className={inputClass} />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={2} value={form.notes} onChange={handleChange} className={`${inputClass} resize-none`} />
        </div>
      </div>

      <p className="text-xs text-[#707975] bg-[#f5f3f3] border border-[#bfc9c4] px-3 py-2">
        TIN, National ID (NIDA), bank account details, and transaction volumes are entered separately on the contract
        page after creation — restricted to Compliance &amp; Security.
      </p>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Creating...' : 'Create Contract'}
      </button>
    </form>
  );
}
