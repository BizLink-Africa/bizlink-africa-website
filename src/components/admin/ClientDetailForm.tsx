'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ONBOARDING_STATUSES, INTEGRATION_STATUSES } from '@/data/clients';
import { updateClientRecord, setClientActive } from '@/app/admin/(protected)/clients/actions';

export default function ClientDetailForm({
  id,
  initialClientName,
  initialBusinessName,
  initialBusinessType,
  initialContactPerson,
  initialEmail,
  initialPhone,
  initialLocation,
  initialOnboardingStatus,
  initialIntegrationStatus,
  initialAssignedStaff,
  initialInternalNotes,
  initialIsActive,
}: {
  id: string;
  initialClientName: string;
  initialBusinessName: string;
  initialBusinessType: string;
  initialContactPerson: string;
  initialEmail: string;
  initialPhone: string;
  initialLocation: string;
  initialOnboardingStatus: string;
  initialIntegrationStatus: string;
  initialAssignedStaff: string;
  initialInternalNotes: string;
  initialIsActive: boolean;
}) {
  const router = useRouter();
  const [clientName, setClientName] = useState(initialClientName);
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [businessType, setBusinessType] = useState(initialBusinessType);
  const [contactPerson, setContactPerson] = useState(initialContactPerson);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [location, setLocation] = useState(initialLocation);
  const [onboardingStatus, setOnboardingStatus] = useState(initialOnboardingStatus);
  const [integrationStatus, setIntegrationStatus] = useState(initialIntegrationStatus);
  const [assignedStaff, setAssignedStaff] = useState(initialAssignedStaff);
  const [internalNotes, setInternalNotes] = useState(initialInternalNotes);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await updateClientRecord(id, {
      clientName,
      businessName,
      businessType,
      contactPerson,
      email,
      phone,
      location,
      onboardingStatus,
      integrationStatus,
      assignedStaff,
      internalNotes,
    });
    setSaving(false);

    if (result.success) {
      setFeedback({ type: 'success', text: 'Saved.' });
      router.refresh();
    } else {
      setFeedback({ type: 'error', text: result.message ?? 'Failed to save.' });
    }
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    const next = !isActive;
    const result = await setClientActive(id, next);
    setTogglingActive(false);

    if (result.success) {
      setIsActive(next);
      router.refresh();
    } else {
      setFeedback({ type: 'error', text: result.message ?? 'Failed to update client status.' });
    }
  };

  return (
    <div className="bg-white border border-[#bfc9c4] p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-[Geist,sans-serif] font-semibold text-[#00342b]">Client Details</h2>
        <button
          type="button"
          onClick={handleToggleActive}
          disabled={togglingActive}
          className={`text-xs font-medium px-3 py-1.5 border transition-colors disabled:opacity-60 ${
            isActive ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-[#00342b] text-[#00342b] hover:bg-[#00342b] hover:text-white'
          }`}
        >
          {togglingActive ? 'Saving...' : isActive ? 'Deactivate' : 'Activate'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="clientName">Client Name</label>
          <input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="businessName">Business Name</label>
          <input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="businessType">Business Type</label>
          <input id="businessType" value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="contactPerson">Contact Person</label>
          <input id="contactPerson" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="phone">Phone / WhatsApp</label>
          <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="location">Location</label>
          <input id="location" value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="assignedStaff">Assigned Staff</label>
          <input id="assignedStaff" value={assignedStaff} onChange={(e) => setAssignedStaff(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="onboardingStatus">Onboarding Status</label>
          <select id="onboardingStatus" value={onboardingStatus} onChange={(e) => setOnboardingStatus(e.target.value)} className={inputClass}>
            {ONBOARDING_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="integrationStatus">Integration Status</label>
          <select id="integrationStatus" value={integrationStatus} onChange={(e) => setIntegrationStatus(e.target.value)} className={inputClass}>
            {INTEGRATION_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="internalNotes">Internal Notes</label>
        <textarea
          id="internalNotes"
          rows={4}
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          placeholder="Notes visible only to BizLink Africa admins..."
          className={`${inputClass} resize-none`}
        />
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
