'use server';

import { revalidatePath } from 'next/cache';
import { verifyAdminSession } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { AGENT_TYPES, AGENT_STATUSES, KNOWLEDGE_BASE_STATUSES } from '@/data/aiAgents';

const VALID_TYPES = new Set<string>(AGENT_TYPES.map((t) => t.value));
const VALID_STATUSES = new Set<string>(AGENT_STATUSES.map((s) => s.value));
const VALID_KB_STATUSES = new Set<string>(KNOWLEDGE_BASE_STATUSES.map((s) => s.value));

export interface AgentConfigInput {
  clientId: string;
  agentType: string;
  agentStatus: string;
  businessHours?: string;
  knowledgeBaseStatus: string;
  productsConfigured: boolean;
  humanHandoverContact?: string;
}

export async function createAgentConfig(input: AgentConfigInput): Promise<{ success: boolean; message?: string }> {
  const user = await verifyAdminSession();

  if (!input.clientId) {
    return { success: false, message: 'A client is required.' };
  }
  if (!VALID_TYPES.has(input.agentType)) {
    return { success: false, message: 'Invalid agent type.' };
  }
  if (!VALID_STATUSES.has(input.agentStatus)) {
    return { success: false, message: 'Invalid agent status.' };
  }
  if (!VALID_KB_STATUSES.has(input.knowledgeBaseStatus)) {
    return { success: false, message: 'Invalid knowledge base status.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ai_agent_configs')
    .insert({
      client_id: input.clientId,
      agent_type: input.agentType,
      agent_status: input.agentStatus,
      business_hours: input.businessHours?.trim() || null,
      knowledge_base_status: input.knowledgeBaseStatus,
      products_configured: input.productsConfigured,
      human_handover_contact: input.humanHandoverContact?.trim() || null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create AI agent config', error);
    return { success: false, message: 'Failed to create AI agent config.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'ai_agent_configs',
    recordId: data.id,
    newValue: input,
  });

  revalidatePath('/admin/ai-agents');
  return { success: true };
}

export async function updateAgentStatus(id: string, agentStatus: string): Promise<{ success: boolean; message?: string }> {
  const user = await verifyAdminSession();

  if (!VALID_STATUSES.has(agentStatus)) {
    return { success: false, message: 'Invalid agent status.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('ai_agent_configs').update({ agent_status: agentStatus }).eq('id', id);

  if (error) {
    console.error('Failed to update agent status', id, error);
    return { success: false, message: 'Failed to update status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_status',
    module: 'ai_agent_configs',
    recordId: id,
    newValue: { agentStatus },
  });

  revalidatePath('/admin/ai-agents');
  return { success: true };
}
