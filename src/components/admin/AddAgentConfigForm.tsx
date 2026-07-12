'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { AGENT_TYPES, AGENT_STATUSES, KNOWLEDGE_BASE_STATUSES } from '@/data/aiAgents';
import { createAgentConfig } from '@/app/admin/(protected)/ai-agents/actions';

const initialForm = {
  clientId: '',
  agentType: AGENT_TYPES[0].value as string,
  agentStatus: 'pending_setup',
  businessHours: '',
  knowledgeBaseStatus: 'not_started',
  productsConfigured: false,
  humanHandoverContact: '',
};

export default function AddAgentConfigForm({ clients }: { clients: Array<{ id: string; client_name: string; business_name: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createAgentConfig(form);
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to create AI agent config.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={clients.length === 0}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-50"
        title={clients.length === 0 ? 'Add a client first' : undefined}
      >
        <Plus size={14} /> Add Agent Config
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-[Geist,sans-serif] font-semibold text-[#00342b]">Add Agent Config</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="clientId">Client</label>
          <select
            id="clientId"
            value={form.clientId}
            onChange={(e) => setForm((prev) => ({ ...prev, clientId: e.target.value }))}
            required
            className={inputClass}
          >
            <option value="">Select a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.client_name} — {c.business_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="agentType">Agent Type</label>
          <select
            id="agentType"
            value={form.agentType}
            onChange={(e) => setForm((prev) => ({ ...prev, agentType: e.target.value }))}
            className={inputClass}
          >
            {AGENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="agentStatus">Agent Status</label>
          <select
            id="agentStatus"
            value={form.agentStatus}
            onChange={(e) => setForm((prev) => ({ ...prev, agentStatus: e.target.value }))}
            className={inputClass}
          >
            {AGENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="knowledgeBaseStatus">Knowledge Base Status</label>
          <select
            id="knowledgeBaseStatus"
            value={form.knowledgeBaseStatus}
            onChange={(e) => setForm((prev) => ({ ...prev, knowledgeBaseStatus: e.target.value }))}
            className={inputClass}
          >
            {KNOWLEDGE_BASE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="businessHours">Business Hours</label>
          <input
            id="businessHours"
            value={form.businessHours}
            onChange={(e) => setForm((prev) => ({ ...prev, businessHours: e.target.value }))}
            placeholder="e.g. Mon–Fri 8AM–5PM EAT"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="humanHandoverContact">Human Handover Contact</label>
          <input
            id="humanHandoverContact"
            value={form.humanHandoverContact}
            onChange={(e) => setForm((prev) => ({ ...prev, humanHandoverContact: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#1b1c1c]">
            <input
              type="checkbox"
              checked={form.productsConfigured}
              onChange={(e) => setForm((prev) => ({ ...prev, productsConfigured: e.target.checked }))}
              className="accent-[#00342b]"
            />
            Products / services configured
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Creating...' : 'Create Config'}
      </button>
    </form>
  );
}
