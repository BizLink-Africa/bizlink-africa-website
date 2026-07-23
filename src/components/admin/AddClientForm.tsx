'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createClientRecord } from '@/app/admin/(protected)/clients/actions';
import StaffPicker, { type StaffOption } from '@/components/admin/crm/StaffPicker';

const initialForm = {
  clientName: '',
  businessName: '',
  businessType: '',
  contactPerson: '',
  email: '',
  phone: '',
  location: '',
  industry: '',
  accountOwnerId: '',
};

export default function AddClientForm({ staff }: { staff: StaffOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateOfId, setDuplicateOfId] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setDuplicateOfId(null);

    const result = await createClientRecord(form);
    setSubmitting(false);

    if (result.success && result.clientId) {
      router.push(`/admin/clients/${result.clientId}`);
    } else {
      setError(result.message ?? 'Failed to create client.');
      setDuplicateOfId(result.duplicateOfId ?? null);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> Add Client
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">Add Client</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="clientName">Client Name</label>
          <input id="clientName" name="clientName" value={form.clientName} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="businessName">Business Name</label>
          <input id="businessName" name="businessName" value={form.businessName} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="businessType">Business Type</label>
          <input id="businessType" name="businessType" value={form.businessType} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="industry">Industry</label>
          <input id="industry" name="industry" value={form.industry} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="contactPerson">Contact Person</label>
          <input id="contactPerson" name="contactPerson" value={form.contactPerson} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="email">Email</label>
          <input id="email" name="email" type="email" value={form.email} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="phone">Phone / WhatsApp</label>
          <input id="phone" name="phone" value={form.phone} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="location">Location</label>
          <input id="location" name="location" value={form.location} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="accountOwnerId">Account Owner</label>
          <StaffPicker
            id="accountOwnerId"
            value={form.accountOwnerId}
            onChange={(value) => setForm((prev) => ({ ...prev, accountOwnerId: value }))}
            staff={staff}
            className={inputClass}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}
          {duplicateOfId && (
            <>
              {' '}
              <a href={`/admin/clients/${duplicateOfId}`} className="underline font-medium">View existing client →</a>
            </>
          )}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Creating...' : 'Create Client'}
      </button>
    </form>
  );
}
