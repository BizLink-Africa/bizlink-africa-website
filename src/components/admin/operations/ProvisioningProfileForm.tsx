'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveProvisioningProfile } from '@/app/admin/(protected)/operations/provisioning/actions';
import type { StaffOption } from '@/components/admin/crm/StaffPicker';
import { PROVISIONING_STATUSES, type ProvisioningStatus } from '@/data/operations';

const MODULE_OPTIONS = ['crm', 'inbox', 'payments', 'reports', 'ai_agents', 'bus_ticketing', 'logistics'];

export default function ProvisioningProfileForm({
  clientId,
  initialEnabledModules,
  initialTechnicalOwner,
  initialActivationDate,
  initialTrainingStatus,
  initialHandoverStatus,
  initialNotes,
  staff,
}: {
  clientId: string;
  initialEnabledModules: string[];
  initialTechnicalOwner: string;
  initialActivationDate: string;
  initialTrainingStatus: ProvisioningStatus;
  initialHandoverStatus: ProvisioningStatus;
  initialNotes: string;
  staff: StaffOption[];
}) {
  const router = useRouter();
  const [enabledModules, setEnabledModules] = useState(new Set(initialEnabledModules));
  const [technicalOwner, setTechnicalOwner] = useState(initialTechnicalOwner);
  const [activationDate, setActivationDate] = useState(initialActivationDate);
  const [trainingStatus, setTrainingStatus] = useState(initialTrainingStatus);
  const [handoverStatus, setHandoverStatus] = useState(initialHandoverStatus);
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const toggleModule = (m: string) => {
    setEnabledModules((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await saveProvisioningProfile({
      clientId,
      enabledModules: Array.from(enabledModules),
      technicalOwner: technicalOwner || undefined,
      activationDate: activationDate || undefined,
      trainingStatus,
      handoverStatus,
      notes: notes || undefined,
    });
    setSaving(false);
    if (result.success) {
      setFeedback({ type: 'success', text: 'Saved.' });
      router.refresh();
    } else {
      setFeedback({ type: 'error', text: result.message ?? 'Failed to save.' });
    }
  };

  return (
    <div className="bg-white border border-[#bfc9c4] p-6 space-y-4">
      <h2 className="font-semibold text-[#00342b]">Provisioning Profile</h2>

      <div>
        <label className={labelClass}>Enabled Modules</label>
        <div className="flex flex-wrap gap-2">
          {MODULE_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => toggleModule(m)}
              className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                enabledModules.has(m) ? 'bg-[#00342b] text-white border-[#00342b]' : 'text-[#3f4945] border-[#bfc9c4] hover:bg-[#f5f3f3]'
              }`}
            >
              {m.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="technicalOwner">Technical Owner</label>
          <select id="technicalOwner" value={technicalOwner} onChange={(e) => setTechnicalOwner(e.target.value)} className={inputClass}>
            <option value="">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="activationDate">Activation Date</label>
          <input id="activationDate" type="date" value={activationDate} onChange={(e) => setActivationDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="trainingStatus">Training Status</label>
          <select id="trainingStatus" value={trainingStatus} onChange={(e) => setTrainingStatus(e.target.value as ProvisioningStatus)} className={inputClass}>
            {PROVISIONING_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="handoverStatus">Handover Status</label>
          <select id="handoverStatus" value={handoverStatus} onChange={(e) => setHandoverStatus(e.target.value as ProvisioningStatus)} className={inputClass}>
            {PROVISIONING_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="notes">Notes</label>
          <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} resize-none`} />
        </div>
      </div>

      {feedback && (
        <p className={`text-sm px-3 py-2 border ${feedback.type === 'success' ? 'text-[#00342b] bg-[#e0f2ee] border-[#afefdd]' : 'text-red-700 bg-red-50 border-red-200'}`}>
          {feedback.text}
        </p>
      )}
      <button onClick={handleSave} disabled={saving} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {saving ? 'Saving...' : 'Save Profile'}
      </button>
    </div>
  );
}
