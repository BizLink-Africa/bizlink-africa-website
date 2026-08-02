import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { hasRecentReauth, SELCOM_INTEGRATION_REAUTH_PURPOSE } from '@/lib/supabase/reauth';
import AccessDenied from '@/components/admin/AccessDenied';
import SelcomReauthPrompt from '@/components/admin/integrations/SelcomReauthPrompt';
import SelcomEnvironmentBadge from '@/components/admin/integrations/SelcomEnvironmentBadge';
import ProductionReadinessChecklist from '@/components/admin/integrations/ProductionReadinessChecklist';
import ProductionActivationPanel from '@/components/admin/integrations/ProductionActivationPanel';
import { getSelcomIntegrationStatus } from '@/lib/selcom/status';
import { getProductionReadinessChecks, getProductionReadinessEvidence, isChecklistComplete, type ProductionApprovalState } from '@/lib/selcom/production-readiness';

export const dynamic = 'force-dynamic';

async function hasPerm(perm: string): Promise<boolean> {
  try {
    await requirePermission(perm);
    return true;
  } catch {
    return false;
  }
}

export default async function SelcomProductionReadinessPage() {
  try {
    await requirePermission('selcom_production.view');
  } catch {
    return <AccessDenied requiredPermission="selcom_production.view" />;
  }

  const [canManageChecklist, canApproveFinance, canApproveCompliance, canAuthorize] = await Promise.all([
    hasPerm('selcom_production.manage_checklist'),
    hasPerm('selcom_production.approve_finance'),
    hasPerm('selcom_production.approve_compliance'),
    hasPerm('selcom_production.authorize'),
  ]);

  // A single shared reauth purpose, same as the rest of the Selcom
  // integration's consequential actions — freshness is checked once here
  // so the page can decide whether to show the reauth-gated sections at
  // all, matching the SelcomIntegrationControls/SelcomReauthPrompt
  // pattern exactly (each action independently re-checks reauth server-
  // side too, this is just the UI gate).
  const needsAnyReauthGatedAction = canApproveFinance || canApproveCompliance || canAuthorize;
  const hasFreshReauth = needsAnyReauthGatedAction ? await hasRecentReauth(SELCOM_INTEGRATION_REAUTH_PURPOSE) : true;

  const supabase = await createClient();
  const [checks, evidence, { data: settingsRow }] = await Promise.all([
    getProductionReadinessChecks(supabase),
    getProductionReadinessEvidence(supabase),
    supabase.from('selcom_integration_settings').select('*').eq('id', true).maybeSingle(),
  ]);

  const status = getSelcomIntegrationStatus();
  const checklistComplete = isChecklistComplete(checks);
  const approvals = (settingsRow ?? {}) as Partial<ProductionApprovalState> & { integration_enabled?: boolean };

  return (
    <div className="max-w-3xl">
      <div className="mb-4 text-xs text-[#707975]">
        <Link href="/admin/settings/integrations/selcom" className="hover:underline">Disbursement API</Link>
        {' / '}
        <span className="text-[#00342b] font-medium">Production Readiness</span>
      </div>

      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Selcom Production Readiness</h1>
          <p className="text-sm text-[#707975] mt-1">
            The controlled path from sandbox to production. Nothing on this page makes production live by itself —
            authorization here is a governance record; going live additionally requires a separate deployment change
            (SELCOM_ENV=production and SELCOM_PRODUCTION_ACTIVATION_ENABLED=true) outside this app.
          </p>
        </div>
        <SelcomEnvironmentBadge environmentRaw={status.environmentRaw} environmentValid={status.environmentValid} />
      </div>

      {status.environmentRaw === 'production' && status.environmentValid && (
        <p className="text-sm font-semibold text-white bg-red-600 px-4 py-3 mb-6">
          This deployment is currently running against Selcom PRODUCTION. Real funds move through this integration.
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] p-4 mb-6 text-sm">
        <p className="font-semibold text-[#00342b] mb-1">Emergency Disable</p>
        <p className="text-xs text-[#707975] mb-2">
          The integration kill switch (independent of environment — stops sandbox AND production activity
          immediately) lives on the main{' '}
          <Link href="/admin/settings/integrations/selcom" className="underline">Disbursement API</Link> page, under
          Manage Configuration. Current state:{' '}
          <span className={`font-medium ${approvals.integration_enabled ? 'text-[#1b7a3d]' : 'text-red-700'}`}>
            {approvals.integration_enabled ? 'Enabled' : 'Disabled'}
          </span>
        </p>
      </div>

      <h2 className="font-semibold text-[#00342b] mb-2">Production Readiness Checklist</h2>
      <div className="mb-6">
        <ProductionReadinessChecklist checks={checks} evidence={evidence} canManage={canManageChecklist} />
      </div>

      <h2 className="font-semibold text-[#00342b] mb-2">Approvals &amp; Authorization</h2>
      {needsAnyReauthGatedAction && !hasFreshReauth ? (
        <SelcomReauthPrompt />
      ) : (
        <ProductionActivationPanel
          approvals={{
            production_finance_approved: approvals.production_finance_approved ?? false,
            production_finance_approved_by: approvals.production_finance_approved_by ?? null,
            production_finance_approved_at: approvals.production_finance_approved_at ?? null,
            production_finance_approval_reason: approvals.production_finance_approval_reason ?? null,
            production_compliance_approved: approvals.production_compliance_approved ?? false,
            production_compliance_approved_by: approvals.production_compliance_approved_by ?? null,
            production_compliance_approved_at: approvals.production_compliance_approved_at ?? null,
            production_compliance_approval_reason: approvals.production_compliance_approval_reason ?? null,
            production_activation_authorized: approvals.production_activation_authorized ?? false,
            production_activation_authorized_by: approvals.production_activation_authorized_by ?? null,
            production_activation_authorized_at: approvals.production_activation_authorized_at ?? null,
            production_activation_authorization_reason: approvals.production_activation_authorization_reason ?? null,
            production_deauthorized_by: approvals.production_deauthorized_by ?? null,
            production_deauthorized_at: approvals.production_deauthorized_at ?? null,
            production_deauthorization_reason: approvals.production_deauthorization_reason ?? null,
          }}
          checklistComplete={checklistComplete}
          canApproveFinance={canApproveFinance}
          canApproveCompliance={canApproveCompliance}
          canAuthorize={canAuthorize}
        />
      )}
    </div>
  );
}
