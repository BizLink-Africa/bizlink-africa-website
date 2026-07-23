import 'server-only';
import { createClient } from '@/lib/supabase/server';

interface AuditEventInput {
  performedBy: string;
  actionType: string;
  module: string;
  recordId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  result?: 'success' | 'failure';
}

// Coarser grouping than `module` for the Audit Logs "Record type" filter —
// derived automatically here so no caller (there are ~40 across the app)
// needs to know or care about it. Add new modules to a bucket as they're
// introduced; anything unmapped falls back to 'general' rather than erroring.
const RECORD_TYPE_BY_MODULE: Record<string, string> = {
  roles: 'governance', role_permissions: 'governance', departments: 'governance',
  approval_workflows: 'governance', approval_requests: 'governance', governance_policies: 'governance',
  staff_profiles: 'staff', access_reviews: 'compliance', security_events: 'security',
  security_incidents: 'security', company_settings: 'settings', support_sla_rules: 'settings',
  support_ticket_categories: 'settings', support_escalation_rules: 'settings',
  marketing_campaign_categories: 'settings', marketing_lead_sources: 'settings',
  technology_deployment_environments: 'settings', compliance_required_documents: 'settings',
  admin_notifications: 'notifications', clients: 'crm', website_leads: 'crm',
  onboarding_checklists: 'operations', proforma_invoices: 'finance', invoices: 'finance',
  expenses: 'finance', contracts: 'operations', support_tickets: 'support',
  integration_health: 'technology', ai_agent_configs: 'technology',
  governance_analytics: 'governance', governance_reports: 'governance',
};

function deriveRecordType(module: string): string {
  return RECORD_TYPE_BY_MODULE[module] ?? 'general';
}

// Never throws — a failed audit write must not break the mutation that
// triggered it. Failures are just logged server-side.
export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('audit_logs').insert({
    performed_by: input.performedBy,
    action_type: input.actionType,
    module: input.module,
    record_id: input.recordId ?? null,
    old_value: input.oldValue ?? null,
    new_value: input.newValue ?? null,
    result: input.result ?? 'success',
    record_type: deriveRecordType(input.module),
  });

  if (error) {
    console.error('Failed to write audit log', input, error);
  }
}

export interface ActivityEntry {
  id: string;
  performed_by: string;
  action_type: string;
  new_value: unknown;
  created_at: string;
}

// "Activity history" for any record — not a new table, just audit_logs
// (already written to by every action in this app) filtered and surfaced
// per-record for the first time. Used by lead/client/opportunity/proposal
// detail pages.
export async function getRecordActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  module: string,
  recordId: string
): Promise<ActivityEntry[]> {
  const { data } = await supabase
    .from('audit_logs')
    .select('id, performed_by, action_type, new_value, created_at')
    .eq('module', module)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false })
    .limit(50);

  return data ?? [];
}
