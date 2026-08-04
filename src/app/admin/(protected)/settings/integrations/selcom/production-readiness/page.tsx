import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import SelcomEnvironmentBadge from '@/components/admin/integrations/SelcomEnvironmentBadge';
import ProductionReadinessChecklist from '@/components/admin/integrations/ProductionReadinessChecklist';
import ProductionActivationPanel from '@/components/admin/integrations/ProductionActivationPanel';
import { getSelcomIntegrationStatus } from '@/lib/selcom/status';
import { getProductionReadinessChecks, getProductionReadinessEvidence, isChecklistComplete, type ProductionApprovalState } from '@/lib/selcom/production-readiness';

export const dynamic = 'force-dynamic';

export default async function SelcomProductionReadinessPage() {
  try {
    await requirePermission('selcom_production.view');
  } catch {
    return <AccessDenied requiredPermission="selcom_production.view" />;
  }

  // This page is a permanently read-only historical record — the
  // operating model changed before live payout activation, so the
  // checklist and approval workflow it displays will never resume. These
  // are intentionally hardcoded false (not computed from the caller's
  // actual permissions, and no re-authentication is requested to view
  // them): every interactive control in
  // ProductionReadinessChecklist/ProductionActivationPanel is already
  // conditional on these props, so forcing them false here guarantees a
  // pure display-only view for every viewer, including Super Admin.
  // Nothing is deleted — see the archived-record notice below and
  // src/lib/archived-financial-prototype.ts for the server-side action
  // guard that independently blocks every write path regardless of this
  // page's rendering.
  const canManageChecklist = false;
  const canApproveFinance = false;
  const canApproveCompliance = false;
  const canAuthorize = false;

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

      <div className="mb-6">
        <p className="text-sm font-semibold text-amber-900 bg-amber-50 border border-amber-300 px-4 py-3">
          Archived — operating model changed before live payout activation.
        </p>
      </div>

      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Production Readiness (Archived)</h1>
          <p className="text-sm text-[#707975] mt-1">
            Historical record of the disbursement production-activation checklist and approvals, preserved read-only
            for audit purposes. BizLink Africa now operates a merchant-managed settlement model — merchants settle
            directly with their approved payment partner, so this workflow will not resume and no further checklist
            items, approvals, or authorizations can be recorded here. For current, provider-neutral integration
            health, see{' '}
            <Link href="/admin/settings/integrations/payment-infrastructure" className="underline">Payment Integration Health</Link>.
          </p>
        </div>
        <SelcomEnvironmentBadge environmentRaw={status.environmentRaw} environmentValid={status.environmentValid} />
      </div>

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

      <h2 className="font-semibold text-[#00342b] mb-2">Approvals &amp; Authorization (Archived Record)</h2>
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
    </div>
  );
}
