import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import SelcomIntegrationLogsPanel, { type SelcomIntegrationLogEntry } from '@/components/admin/integrations/SelcomIntegrationLogsPanel';
import { getSelcomIntegrationStatus, type SelcomCredentialStatus } from '@/lib/selcom/status';
import { MERCHANT_TILL_STATUSES } from '@/data/merchantOperations';

export const dynamic = 'force-dynamic';

// Only technical, provider-neutral integration health — never payout
// execution, approval, or balance information. See the compliance card
// below and docs/SELCOM_PRODUCTION_READINESS_REPORT.md for the retired
// disbursement-activation workflow this page replaces for day-to-day use
// (that workflow is preserved, read-only, at
// /admin/settings/integrations/selcom/production-readiness — Super Admin
// only, for audit history).
const COMPLIANCE_TEXT =
  'BizLink Africa provides payment-integration and technical support only. Each merchant manages their own payment account and settlement directly with the approved payment partner. BizLink Africa does not hold or settle merchant funds.';

const CREDENTIAL_STATUS_LABEL: Record<SelcomCredentialStatus, string> = {
  not_configured: 'Not configured',
  incomplete: 'Incomplete',
  invalid_key: 'Invalid private key',
  configured: 'Configured',
};

const CREDENTIAL_STATUS_COLOR: Record<SelcomCredentialStatus, string> = {
  not_configured: 'bg-[#f5f3f3] text-[#707975]',
  incomplete: 'bg-orange-50 text-[#8a5a00]',
  invalid_key: 'bg-red-50 text-red-700',
  configured: 'bg-green-50 text-[#1b7a3d]',
};

// Only non-financial, non-disbursement log entries — balance checks/
// refreshes and production-activation requests are deliberately excluded
// from this provider-neutral health view.
const VISIBLE_LOG_ACTION_TYPES = [
  'connection_test',
  'callback_configuration_change',
  'callback_configuration_check',
  'callback_simulation',
  'credential_configuration_change',
  'environment_change',
  'integration_enabled',
  'integration_disabled',
];

interface AuditLogRow {
  id: string;
  performed_by: string;
  action_type: string;
  result: 'success' | 'failure';
  reason: string | null;
  created_at: string;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function PaymentIntegrationHealthPage() {
  try {
    await requirePermission('integrations.view');
  } catch {
    return <AccessDenied requiredPermission="integrations.view" />;
  }

  const status = getSelcomIntegrationStatus();
  const supabase = await createClient();

  const [{ data: logRows }, { data: tillRows }, { count: kbArticleCountRaw }, { count: escalationRuleCountRaw }] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('id, performed_by, action_type, result, reason, created_at')
      .eq('module', 'selcom_integration')
      .in('action_type', VISIBLE_LOG_ACTION_TYPES)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('merchant_tills').select('status'),
    supabase.from('kb_articles').select('id', { count: 'exact', head: true }),
    supabase.from('support_escalation_rules').select('priority', { count: 'exact', head: true }),
  ]);

  const logs = (logRows ?? []) as AuditLogRow[];
  const tillStatusCounts = new Map<string, number>();
  for (const row of (tillRows ?? []) as { status: string }[]) {
    tillStatusCounts.set(row.status, (tillStatusCounts.get(row.status) ?? 0) + 1);
  }
  const totalTills = (tillRows ?? []).length;
  const kbArticleCount = kbArticleCountRaw ?? 0;
  const escalationRuleCount = escalationRuleCountRaw ?? 0;

  const lastSuccessfulRequest = logs.find((l) => l.result === 'success') ?? null;
  const lastFailedRequest = logs.find((l) => l.result === 'failure') ?? null;

  return (
    <div className="max-w-3xl">
      <div className="mb-4 text-xs text-[#707975]">
        <Link href="/admin/settings" className="hover:underline">Administration</Link>
        {' / '}
        <span>Integrations</span>
        {' / '}
        <span className="text-[#00342b] font-medium">Payment Integration Health</span>
      </div>

      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Payment Integration Health</h1>
          <p className="text-sm text-[#707975] mt-1">
            Technical status of the payment-integration connection — for troubleshooting and support only. No
            payout, settlement, or balance information is shown here.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-purple-50 text-purple-700">
          {status.environmentRaw === 'production' ? 'Production' : 'Sandbox'} environment
        </span>
      </div>

      {/* Compliance card */}
      <div className="mb-6 border border-[#afefdd] bg-[#afefdd]/10 p-5 flex items-start gap-3">
        <ShieldCheck size={18} className="text-[#00342b] mt-0.5 shrink-0" />
        <p className="text-sm text-[#3f4945] leading-relaxed">{COMPLIANCE_TEXT}</p>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Field label="Integration Environment">{status.environmentRaw === 'production' ? 'Production' : 'Sandbox'}</Field>
          <Field label="API Connection Status">
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${CREDENTIAL_STATUS_COLOR[status.credentialStatus]}`}>
              {CREDENTIAL_STATUS_LABEL[status.credentialStatus]}
            </span>
          </Field>
          <Field label="Callback Status">
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${status.callbackConfigured ? 'bg-green-50 text-[#1b7a3d]' : 'bg-orange-50 text-[#8a5a00]'}`}>
              {status.callbackConfigured ? 'Configured' : 'Incomplete'}
            </span>
          </Field>
          <Field label="Credential Configured (Masked)">{status.maskedApiKey ?? '—'}</Field>
          <Field label="Last Successful API Request">
            {lastSuccessfulRequest ? `${formatDate(lastSuccessfulRequest.created_at)} — ${lastSuccessfulRequest.performed_by}` : '—'}
          </Field>
          <Field label="Last Failed API Request">
            {lastFailedRequest ? `${formatDate(lastFailedRequest.created_at)} — ${lastFailedRequest.performed_by}` : '—'}
          </Field>
        </dl>

        {status.missingEnvVars.length > 0 && (
          <p className="text-xs text-[#8a5a00] bg-orange-50 border border-orange-200 px-3 py-2 mt-4">
            Missing environment variable(s): {status.missingEnvVars.join(', ')}. Set these in your deployment&apos;s
            environment configuration — never in this dashboard.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-[#bfc9c4] p-5">
          <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-2">Merchant Account/Till Status</p>
          <p className="text-2xl font-bold text-[#00342b] mb-2">{totalTills}</p>
          <div className="space-y-1">
            {MERCHANT_TILL_STATUSES.map((s) => (
              <div key={s.value} className="flex items-center justify-between text-xs text-[#3f4945]">
                <span>{s.label}</span>
                <span className="font-medium">{tillStatusCounts.get(s.value) ?? 0}</span>
              </div>
            ))}
          </div>
          <Link href="/admin/merchant-operations/tills" className="text-xs font-medium text-[#00342b] underline mt-3 inline-block">
            View Merchant Accounts/Tills →
          </Link>
        </div>

        <div className="bg-white border border-[#bfc9c4] p-5">
          <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-2">Transaction-Status Monitoring</p>
          <p className="text-sm text-[#3f4945] leading-relaxed mb-3">
            Technical status of individual payment-integration transactions, for troubleshooting only.
          </p>
          <Link href="/admin/integration-health/transactions" className="text-xs font-medium text-[#00342b] underline">
            View Transaction Status →
          </Link>
        </div>

        <div className="bg-white border border-[#bfc9c4] p-5">
          <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-2">Technical Documentation Status</p>
          <p className="text-2xl font-bold text-[#00342b] mb-1">{kbArticleCount}</p>
          <p className="text-xs text-[#707975]">article(s) in the Knowledge Base</p>
          <Link href="/admin/support/knowledge-base" className="text-xs font-medium text-[#00342b] underline mt-3 inline-block">
            View Knowledge Base →
          </Link>
        </div>

        <div className="bg-white border border-[#bfc9c4] p-5">
          <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-2">Support Escalation Status</p>
          <p className="text-2xl font-bold text-[#00342b] mb-1">{escalationRuleCount}</p>
          <p className="text-xs text-[#707975]">escalation rule(s) configured</p>
          <Link href="/admin/support-tickets/escalations" className="text-xs font-medium text-[#00342b] underline mt-3 inline-block">
            View Escalations →
          </Link>
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-[#00342b] mb-2">Integration Logs</h2>
        <SelcomIntegrationLogsPanel logs={logs as SelcomIntegrationLogEntry[]} />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-semibold text-[#707975] uppercase tracking-wider text-xs mb-1">{label}</dt>
      <dd className="text-[#1b1c1c]">{children}</dd>
    </div>
  );
}
