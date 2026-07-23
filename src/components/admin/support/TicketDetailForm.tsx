'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateTicketDetails } from '@/app/admin/(protected)/support-tickets/actions';
import { DEPARTMENTS, type Department } from '@/data/tickets';

interface Option {
  id: string;
  label: string;
}

export default function TicketDetailForm({
  ticketId,
  initialDescription,
  initialContactPerson,
  initialContactEmail,
  initialDepartment,
  initialRelatedServiceId,
  initialRelatedIntegrationId,
  initialRelatedAiAgentId,
  services,
  integrations,
  aiAgents,
}: {
  ticketId: string;
  initialDescription: string;
  initialContactPerson: string;
  initialContactEmail: string;
  initialDepartment: Department | '';
  initialRelatedServiceId: string;
  initialRelatedIntegrationId: string;
  initialRelatedAiAgentId: string;
  services: Option[];
  integrations: Option[];
  aiAgents: Option[];
}) {
  const router = useRouter();
  const [description, setDescription] = useState(initialDescription);
  const [contactPerson, setContactPerson] = useState(initialContactPerson);
  const [contactEmail, setContactEmail] = useState(initialContactEmail);
  const [department, setDepartment] = useState<Department | ''>(initialDepartment);
  const [relatedServiceId, setRelatedServiceId] = useState(initialRelatedServiceId);
  const [relatedIntegrationId, setRelatedIntegrationId] = useState(initialRelatedIntegrationId);
  const [relatedAiAgentId, setRelatedAiAgentId] = useState(initialRelatedAiAgentId);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await updateTicketDetails(ticketId, {
      description,
      contactPerson,
      contactEmail,
      department: department || undefined,
      relatedServiceId: relatedServiceId || undefined,
      relatedIntegrationId: relatedIntegrationId || undefined,
      relatedAiAgentId: relatedAiAgentId || undefined,
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
      <h2 className="font-semibold text-[#00342b]">Ticket Details</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="description">Description</label>
          <textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} resize-none`} />
        </div>
        <div>
          <label className={labelClass} htmlFor="contactPerson">Contact Person</label>
          <input id="contactPerson" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="contactEmail">Contact Email</label>
          <input id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="department">Assigned Department</label>
          <select id="department" value={department} onChange={(e) => setDepartment(e.target.value as Department)} className={inputClass}>
            <option value="">Not set</option>
            {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="relatedServiceId">Related Service</label>
          <select id="relatedServiceId" value={relatedServiceId} onChange={(e) => setRelatedServiceId(e.target.value)} className={inputClass}>
            <option value="">None</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="relatedIntegrationId">Related Integration</label>
          <select id="relatedIntegrationId" value={relatedIntegrationId} onChange={(e) => setRelatedIntegrationId(e.target.value)} className={inputClass}>
            <option value="">None</option>
            {integrations.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="relatedAiAgentId">Related AI Agent</label>
          <select id="relatedAiAgentId" value={relatedAiAgentId} onChange={(e) => setRelatedAiAgentId(e.target.value)} className={inputClass}>
            <option value="">None</option>
            {aiAgents.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
      </div>
      {feedback && (
        <p className={`text-sm px-3 py-2 border ${feedback.type === 'success' ? 'text-[#00342b] bg-[#e0f2ee] border-[#afefdd]' : 'text-red-700 bg-red-50 border-red-200'}`}>
          {feedback.text}
        </p>
      )}
      <button onClick={handleSave} disabled={saving} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}
