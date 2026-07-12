import { createClient } from '@/lib/supabase/server';
import { AGENT_TYPES, AGENT_STATUSES, KNOWLEDGE_BASE_STATUSES, type AiAgentConfig } from '@/data/aiAgents';
import { labelFor } from '@/data/inquiries';
import AddAgentConfigForm from '@/components/admin/AddAgentConfigForm';
import InlineSelect from '@/components/admin/InlineSelect';
import { updateAgentStatus } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  active: 'text-[#1b7a3d]',
  warning: 'text-[#8a5a00]',
  failed: 'text-[#8a1f1f]',
  pending_setup: 'text-[#707975]',
  disabled: 'text-[#707975]',
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

interface AgentRow extends AiAgentConfig {
  clients: { client_name: string; business_name: string } | null;
}

export default async function AiAgentsPage() {
  const supabase = await createClient();

  const [{ data: clients }, { data, error }] = await Promise.all([
    supabase.from('clients').select('id, client_name, business_name').order('client_name', { ascending: true }),
    supabase.from('ai_agent_configs').select('*, clients(client_name, business_name)').order('updated_at', { ascending: false }),
  ]);

  const agents = (data ?? []) as unknown as AgentRow[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-[Geist,sans-serif] font-bold text-2xl text-[#00342b]">AI Agents</h1>
          <p className="text-sm text-[#707975] mt-1">{agents.length} configured agent{agents.length === 1 ? '' : 's'}</p>
        </div>
        <AddAgentConfigForm clients={clients ?? []} />
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load AI agents: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Agent Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Knowledge Base</th>
              <th className="px-4 py-3">Business Hours</th>
              <th className="px-4 py-3">Handover Contact</th>
              <th className="px-4 py-3">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">{agent.clients?.client_name ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{labelFor(AGENT_TYPES, agent.agent_type)}</td>
                <td className="px-4 py-3">
                  <InlineSelect
                    value={agent.agent_status}
                    options={AGENT_STATUSES}
                    onSave={updateAgentStatus.bind(null, agent.id)}
                    className={`border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none ${STATUS_COLORS[agent.agent_status] ?? ''}`}
                  />
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{labelFor(KNOWLEDGE_BASE_STATUSES, agent.knowledge_base_status)}</td>
                <td className="px-4 py-3 text-[#3f4945]">{agent.business_hours ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{agent.human_handover_contact ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">{formatDateTime(agent.updated_at)}</td>
              </tr>
            ))}
            {agents.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No AI agents configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
