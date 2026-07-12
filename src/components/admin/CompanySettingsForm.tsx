'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateCompanySettings } from '@/app/admin/(protected)/settings/actions';

export default function CompanySettingsForm({
  initialBusinessName,
  initialBusinessEmail,
  initialSupportEmail,
  initialPhoneWhatsapp,
  initialLocation,
}: {
  initialBusinessName: string;
  initialBusinessEmail: string;
  initialSupportEmail: string;
  initialPhoneWhatsapp: string;
  initialLocation: string;
}) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [businessEmail, setBusinessEmail] = useState(initialBusinessEmail);
  const [supportEmail, setSupportEmail] = useState(initialSupportEmail);
  const [phoneWhatsapp, setPhoneWhatsapp] = useState(initialPhoneWhatsapp);
  const [location, setLocation] = useState(initialLocation);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await updateCompanySettings({ businessName, businessEmail, supportEmail, phoneWhatsapp, location });
    setSaving(false);

    if (result.success) {
      setFeedback({ type: 'success', text: 'Saved.' });
      router.refresh();
    } else {
      setFeedback({ type: 'error', text: result.message ?? 'Failed to save.' });
    }
  };

  return (
    <div className="bg-white border border-[#bfc9c4] p-6 space-y-5">
      <div>
        <h2 className="font-[Geist,sans-serif] font-semibold text-[#00342b]">Company Profile & Contact Details</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="businessName">Business Name</label>
          <input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="businessEmail">Business Email</label>
          <input id="businessEmail" type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="supportEmail">Support Email</label>
          <input id="supportEmail" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="phoneWhatsapp">Phone / WhatsApp</label>
          <input id="phoneWhatsapp" value={phoneWhatsapp} onChange={(e) => setPhoneWhatsapp(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="location">Location</label>
          <input id="location" value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} />
        </div>
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
