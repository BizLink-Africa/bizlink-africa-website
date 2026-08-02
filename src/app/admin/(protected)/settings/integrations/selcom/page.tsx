import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { hasRecentReauth, SELCOM_INTEGRATION_REAUTH_PURPOSE } from '@/lib/supabase/reauth';
import AccessDenied from '@/components/admin/AccessDenied';
import SelcomReauthPrompt from '@/components/admin/integrations/SelcomReauthPrompt';
import SelcomIntegrationControls from '@/components/admin/integrations/SelcomIntegrationControls';
import SelcomTestActions from '@/components/admin/integrations/SelcomTestActions';
import SelcomIntegrationLogsPanel, { type SelcomIntegrationLogEntry } from '@/components/admin/integrations/SelcomIntegrationLogsPanel';
import SelcomCallbackEventsPanel, { type SelcomCallbackEventEntry } from '@/components/admin/integrations/SelcomCallbackEventsPanel';
import SelcomCallbackTestPanel, { type TestablePayoutOption } from '@/components/admin/integrations/SelcomCallbackTestPanel';
import SelcomEnvironmentBadge from '@/components/admin/integrations/SelcomEnvironmentBadge';
import { getSelcomIntegrationStatus, type SelcomCredentialStatus } from '@/lib/selcom/status';
import { syncSelcomConfigurationSnapshot } from './sync';

export const dynamic = 'force-dynamic';

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

interface IntegrationSettingsRow {
  integration_enabled: boolean;
  production_activation_status: 'not_requested' | 'requested';
  production_activation_requested_by: string | null;
  production_activation_requested_at: string | null;
  production_activation_reason: string | null;
}

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

export default async function SelcomIntegrationPage() {
  try {
    await requirePermission('integrations.selcom.view');
  } catch {
    return <AccessDenied requiredPermission="integrations.selcom.view" />;
  }

  const permissionChecks = await Promise.all(
    ['integrations.selcom.manage', 'integrations.selcom.test', 'integrations.selcom.balance'].map(async (perm) => {
      try {
        await requirePermission(perm);
        return true;
      } catch {
        return false;
      }
    })
  );
  const [canManage, canTest, canBalance] = permissionChecks;

  // Detect + log drift in the externally-managed (Vercel) env vars before
  // reading anything else — best-effort, never throws (see sync.ts).
  await syncSelcomConfigurationSnapshot();

  const status = getSelcomIntegrationStatus();

  const supabase = await createClient();
  const [{ data: settingsRow }, { data: logRows }] = await Promise.all([
    supabase.from('selcom_integration_settings').select('*').eq('id', true).maybeSingle(),
    supabase
      .from('audit_logs')
      .select('id, performed_by, action_type, result, reason, created_at')
      .eq('module', 'selcom_integration')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const settings = settingsRow as IntegrationSettingsRow | null;
  const logs = (logRows ?? []) as AuditLogRow[];

  // Service client: integrations.selcom.test holders (e.g. CTO) are not
  // guaranteed to also hold payouts.view, and callback events are keyed to
  // payouts a test-only viewer may not otherwise be allowed to browse —
  // same trust boundary the real callback route itself already operates
  // in. Only fetched when there's a reason to show it.
  let callbackEvents: SelcomCallbackEventEntry[] = [];
  let testablePayouts: TestablePayoutOption[] = [];
  if (canTest) {
    const serviceClient = createServiceClient();
    const [{ data: eventRows }, { data: payoutRows }] = await Promise.all([
      serviceClient
        .from('selcom_callback_events')
        .select('id, received_at, reference_id, raw_status, masked_sender_account_number, masked_recipient_account_number, payout_id, outcome, rejection_reason, dry_run')
        .order('received_at', { ascending: false })
        .limit(50),
      serviceClient
        .from('merchant_payouts')
        .select('id, payout_reference, amount, status')
        .in('status', ['submitted', 'processing', 'unknown'])
        .order('requested_at', { ascending: false })
        .limit(50),
    ]);
    callbackEvents = (eventRows ?? []) as SelcomCallbackEventEntry[];
    testablePayouts = (payoutRows ?? []) as TestablePayoutOption[];
  }

  const lastSuccessfulTest = logs.find((l) => l.action_type === 'connection_test' && l.result === 'success') ?? null;
  const lastFailedTest = logs.find((l) => l.action_type === 'connection_test' && l.result === 'failure') ?? null;

  const canManageNow = canManage && (await hasRecentReauth(SELCOM_INTEGRATION_REAUTH_PURPOSE));

  return (
    <div className="max-w-3xl">
      <div className="mb-4 text-xs text-[#707975]">
        <Link href="/admin/settings" className="hover:underline">Administration</Link>
        {' / '}
        <span>Integrations</span>
        {' / '}
        <span className="text-[#00342b] font-medium">Disbursement API</span>
      </div>

      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Selcom Disbursement API</h1>
          <p className="text-sm text-[#707975] mt-1">
            Configuration status for the Selcom Business Infinity Disbursement integration (src/lib/selcom/).
            Credentials are managed exclusively through server environment variables — never entered, edited, or
            displayed in full here. For the live account balance, see{' '}
            <Link href="/admin/settlement/balance" className="underline">Disbursement Balance</Link>. For the
            controlled path to production, see{' '}
            <Link href="/admin/settings/integrations/selcom/production-readiness" className="underline">Production Readiness</Link>.
          </p>
        </div>
        <SelcomEnvironmentBadge environmentRaw={status.environmentRaw} environmentValid={status.environmentValid} />
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Field label="Environment">
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${status.environmentValid ? 'bg-green-50 text-[#1b7a3d]' : 'bg-red-50 text-red-700'}`}>
              {status.environmentRaw === 'sandbox' ? 'Sandbox' : 'Production'}
              {!status.environmentValid && ' (misconfigured — production requires SELCOM_PRODUCTION_ACTIVATION_ENABLED=true)'}
            </span>
          </Field>
          <Field label="Credential Status">
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${CREDENTIAL_STATUS_COLOR[status.credentialStatus]}`}>
              {CREDENTIAL_STATUS_LABEL[status.credentialStatus]}
            </span>
          </Field>
          <Field label="API Key">{status.maskedApiKey ?? '—'}</Field>
          <Field label="Infinity Disbursement Account">{status.maskedDisbursementAccount ?? '—'}</Field>
          <Field label="Callback Configuration">
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${status.callbackConfigured ? 'bg-green-50 text-[#1b7a3d]' : 'bg-orange-50 text-[#8a5a00]'}`}>
              {status.callbackConfigured ? 'Configured' : 'Incomplete'}
            </span>
          </Field>
          <Field label="Integration">
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${settings?.integration_enabled ? 'bg-green-50 text-[#1b7a3d]' : 'bg-[#f5f3f3] text-[#707975]'}`}>
              {settings?.integration_enabled ? 'Enabled' : 'Disabled'}
            </span>
          </Field>
          <Field label="Production Activation">
            {settings?.production_activation_status === 'requested' ? (
              <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-orange-50 text-[#8a5a00]">
                Requested {formatDate(settings.production_activation_requested_at)} by {settings.production_activation_requested_by}
              </span>
            ) : (
              <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-[#f5f3f3] text-[#707975]">Not requested</span>
            )}
          </Field>

          <Field label="Last Successful Connection Test">
            {lastSuccessfulTest ? `${formatDate(lastSuccessfulTest.created_at)} — ${lastSuccessfulTest.performed_by}` : '—'}
          </Field>
          <Field label="Last Failed Connection Test">
            {lastFailedTest ? `${formatDate(lastFailedTest.created_at)} — ${lastFailedTest.performed_by}` : '—'}
          </Field>
        </dl>

        {status.missingEnvVars.length > 0 && (
          <p className="text-xs text-[#8a5a00] bg-orange-50 border border-orange-200 px-3 py-2 mt-4">
            Missing environment variable(s): {status.missingEnvVars.join(', ')}. Set these in your deployment&apos;s
            environment configuration (see .env.example) — never in this dashboard.
          </p>
        )}
      </div>

      {(canTest || canBalance) && (
        <div className="mb-6">
          <h2 className="font-semibold text-[#00342b] mb-2">Sandbox Checks</h2>
          <SelcomTestActions canTest={canTest} canBalance={canBalance} />
        </div>
      )}

      {canTest && (
        <div className="mb-6">
          <h2 className="font-semibold text-[#00342b] mb-2">Callback Testing (Sandbox)</h2>
          <p className="text-xs text-[#707975] mb-3">
            Simulates what Selcom sends to POST /api/integrations/selcom/callback/[secret] for a real sandbox payout,
            without waiting for an actual Selcom callback to arrive. Dry run validates every check (reference, amount,
            destination, payout state) without changing anything; sending live goes through the real endpoint and can
            mark the selected payout Successful.
          </p>
          <SelcomCallbackTestPanel payouts={testablePayouts} />
        </div>
      )}

      {canManage && (
        <div className="mb-6">
          <h2 className="font-semibold text-[#00342b] mb-2">Manage Configuration</h2>
          {canManageNow ? (
            <SelcomIntegrationControls
              integrationEnabled={settings?.integration_enabled ?? false}
              productionActivationStatus={settings?.production_activation_status ?? 'not_requested'}
            />
          ) : (
            <SelcomReauthPrompt />
          )}
        </div>
      )}

      {canTest && (
        <div className="mb-6">
          <h2 className="font-semibold text-[#00342b] mb-2">Recent Callback Events</h2>
          <p className="text-xs text-[#707975] mb-3">
            Every callback this app has received or simulated. Unknown references are flagged here — this list IS the
            security-review queue for callbacks that couldn&apos;t be matched to a payout. Account values are always
            masked.
          </p>
          <SelcomCallbackEventsPanel events={callbackEvents} />
        </div>
      )}

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
