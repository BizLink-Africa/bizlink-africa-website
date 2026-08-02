import 'server-only';
import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

type AuditSupabaseClient = Pick<Awaited<ReturnType<typeof createClient>>, 'from'>;

interface AuditEventInput {
  performedBy: string;
  actionType: string;
  module: string;
  recordId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  result?: 'success' | 'failure';
  // "Record actor, role, action, module, record, old values, new values,
  // reason, timestamp, IP, user agent, correlation ID." role/ip/user
  // agent/correlationId are auto-populated below when omitted — no
  // existing call site needs to change. reason has no safe default (it's
  // only meaningful when the caller actually has one), so it stays opt-in.
  reason?: string;
  role?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  // Defaults to the cookie-bound RLS client (correct for the ~40 staff
  // call sites). audit_logs INSERT is gated by is_active_staff(), so a
  // non-staff writer (e.g. the merchant terms-acceptance action) must pass
  // a service-role client here instead, or the write is silently rejected
  // by RLS (logAuditEvent never throws — see below).
  client?: AuditSupabaseClient;
}

// Best-effort — headers() is only available inside an active request scope
// (Server Action, Route Handler, Server Component render). If this is ever
// called outside one (it currently never is), fall back to nulls rather
// than throwing, since a failed audit write must never break the caller.
async function captureRequestContext(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  try {
    const headerList = await headers();
    const forwardedFor = headerList.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : headerList.get('x-real-ip');
    return { ipAddress: ipAddress ?? null, userAgent: headerList.get('user-agent') };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
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
  merchant_terms_acceptances: 'compliance',
  merchants: 'compliance', merchant_documents: 'compliance', merchant_document_files: 'compliance',
  merchant_data_processing_consent: 'compliance', merchant_kyc_reviews: 'compliance',
  merchant_beneficiary_change_requests: 'compliance', merchant_settlement_beneficiaries: 'compliance',
  collection_import_batches: 'finance', collection_transactions: 'finance',
  collection_reconciliation_runs: 'finance', collection_manual_adjustments: 'finance',
  commission_fee_rules: 'finance', commission_fee_rule_tiers: 'finance',
  settlement_batches: 'finance', settlement_batch_lines: 'finance',
  settlement_batch_exclusions: 'finance', settlement_batch_events: 'finance',
  merchant_payouts: 'finance', merchant_payout_events: 'finance',
  chargeback_cases: 'compliance', chargeback_case_events: 'compliance', chargeback_evidence_items: 'compliance',
  settlement_holds: 'compliance', settlement_hold_events: 'compliance',
  manual_reversal_requests: 'finance',
  merchant_statements: 'finance', financial_reports: 'finance',
  selcom_integration: 'technology', selcom_callback: 'finance',
};

function deriveRecordType(module: string): string {
  return RECORD_TYPE_BY_MODULE[module] ?? 'general';
}

// Never throws — a failed audit write must not break the mutation that
// triggered it. Failures are just logged server-side.
export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  const supabase = input.client ?? (await createClient());

  let role = input.role ?? null;
  if (!role) {
    // Best-effort — performedBy is usually an email (staff) but can be a
    // non-staff identifier (e.g. a merchant), in which case this simply
    // finds nothing and role stays null rather than erroring.
    const { data: staffProfile } = await supabase
      .from('staff_profiles')
      .select('role')
      .eq('email', input.performedBy)
      .maybeSingle();
    role = staffProfile?.role ?? null;
  }

  const { ipAddress, userAgent } = input.ipAddress || input.userAgent
    ? { ipAddress: input.ipAddress ?? null, userAgent: input.userAgent ?? null }
    : await captureRequestContext();

  const { error } = await supabase.from('audit_logs').insert({
    performed_by: input.performedBy,
    action_type: input.actionType,
    module: input.module,
    record_id: input.recordId ?? null,
    old_value: input.oldValue ?? null,
    new_value: input.newValue ?? null,
    result: input.result ?? 'success',
    record_type: deriveRecordType(input.module),
    role,
    reason: input.reason ?? null,
    ip_address: ipAddress,
    user_agent: userAgent,
    correlation_id: input.correlationId ?? randomUUID(),
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
