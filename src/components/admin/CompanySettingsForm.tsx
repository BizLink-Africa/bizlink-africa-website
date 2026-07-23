'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateCompanySettings, type CompanySettingsInput } from '@/app/admin/(protected)/settings/company/actions';

export default function CompanySettingsForm({ initial }: { initial: CompanySettingsInput }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await updateCompanySettings(form);
    setSaving(false);

    if (result.success) {
      setFeedback({ type: 'success', text: 'Saved.' });
      router.refresh();
    } else {
      setFeedback({ type: 'error', text: result.message ?? 'Failed to save.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#bfc9c4] p-6 space-y-4">
        <h2 className="font-semibold text-[#00342b]">Company Profile & Contact Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="businessName">Business Name</label>
            <input id="businessName" value={form.businessName} onChange={(e) => setForm((p) => ({ ...p, businessName: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="businessEmail">Business Email</label>
            <input id="businessEmail" type="email" value={form.businessEmail} onChange={(e) => setForm((p) => ({ ...p, businessEmail: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="supportEmail">Support Email</label>
            <input id="supportEmail" type="email" value={form.supportEmail} onChange={(e) => setForm((p) => ({ ...p, supportEmail: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="phoneWhatsapp">Phone / WhatsApp</label>
            <input id="phoneWhatsapp" value={form.phoneWhatsapp} onChange={(e) => setForm((p) => ({ ...p, phoneWhatsapp: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="location">Location</label>
            <input id="location" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} className={inputClass} />
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 space-y-4">
        <h2 className="font-semibold text-[#00342b]">Logo & Registration Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="logoUrl">Logo URL</label>
            <input id="logoUrl" value={form.logoUrl ?? ''} placeholder="https://..." onChange={(e) => setForm((p) => ({ ...p, logoUrl: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="businessRegistrationNumber">Business Registration Number</label>
            <input id="businessRegistrationNumber" value={form.businessRegistrationNumber ?? ''} onChange={(e) => setForm((p) => ({ ...p, businessRegistrationNumber: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="taxIdentificationNumber">Tax Identification Number</label>
            <input id="taxIdentificationNumber" value={form.taxIdentificationNumber ?? ''} onChange={(e) => setForm((p) => ({ ...p, taxIdentificationNumber: e.target.value }))} className={inputClass} />
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 space-y-4">
        <h2 className="font-semibold text-[#00342b]">Branding</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="brandPrimaryColor">Primary Color</label>
            <div className="flex items-center gap-2">
              <input id="brandPrimaryColor" type="color" value={form.brandPrimaryColor} onChange={(e) => setForm((p) => ({ ...p, brandPrimaryColor: e.target.value }))} className="h-9 w-12 border border-[#bfc9c4]" />
              <input value={form.brandPrimaryColor} onChange={(e) => setForm((p) => ({ ...p, brandPrimaryColor: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="brandSecondaryColor">Secondary Color</label>
            <div className="flex items-center gap-2">
              <input id="brandSecondaryColor" type="color" value={form.brandSecondaryColor} onChange={(e) => setForm((p) => ({ ...p, brandSecondaryColor: e.target.value }))} className="h-9 w-12 border border-[#bfc9c4]" />
              <input value={form.brandSecondaryColor} onChange={(e) => setForm((p) => ({ ...p, brandSecondaryColor: e.target.value }))} className={inputClass} />
            </div>
          </div>
        </div>
        <p className="text-xs text-[#707975]">
          Stored for reference and future use in generated documents/emails — the admin dashboard&apos;s own UI theme is not re-themed live from these values.
        </p>
      </div>

      {feedback && (
        <p className={`text-sm px-3 py-2 border ${feedback.type === 'success' ? 'text-[#00342b] bg-[#e0f2ee] border-[#afefdd]' : 'text-red-700 bg-red-50 border-red-200'}`}>
          {feedback.text}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}
