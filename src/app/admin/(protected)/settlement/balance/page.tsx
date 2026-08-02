import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createServiceClient } from '@/lib/supabase/service';
import AccessDenied from '@/components/admin/AccessDenied';
import SelcomDisbursementBalanceCard from '@/components/admin/integrations/SelcomDisbursementBalanceCard';
import { getDisbursementBalanceDashboard } from '@/lib/selcom/balance-service';
import { getSelcomIntegrationStatus } from '@/lib/selcom/status';

export const dynamic = 'force-dynamic';

// Finance-facing balance dashboard — deliberately a separate page from
// Administration -> Integrations -> Disbursement API
// (settings/integrations/selcom/page.tsx), gated by its own permission
// (disbursement_balance.view) rather than integrations.selcom.view.
// finance_approver holds the former but not the latter — they have no
// reason to see Selcom credential/callback configuration, only the
// account balance and what it means for payouts they approve. Reuses the
// exact same SelcomDisbursementBalanceCard component and
// refreshDisbursementBalance server action as the integration settings
// page would if it also showed this, so the two audiences never see
// different logic.
export default async function DisbursementBalancePage() {
  let canRefresh = true;
  try {
    await requirePermission('disbursement_balance.view');
  } catch {
    return <AccessDenied requiredPermission="disbursement_balance.view" />;
  }
  try {
    await requirePermission('disbursement_balance.refresh');
  } catch {
    canRefresh = false;
  }

  // Service client: disbursement_balance.view holders (finance_approver)
  // aren't guaranteed to hold payouts.view, and the pending-approved-
  // payouts total needs to read merchant_payouts regardless.
  const serviceClient = createServiceClient();
  const dashboard = await getDisbursementBalanceDashboard(serviceClient);

  // Environment/sandbox badge only — never any other credential detail
  // from status.ts, which stays scoped to the integration settings page.
  const status = getSelcomIntegrationStatus();

  return (
    <div className="max-w-3xl">
      <div className="mb-4 text-xs text-[#707975]">
        <Link href="/admin/settlement" className="hover:underline">Settlement & Payouts</Link>
        {' / '}
        <span className="text-[#00342b] font-medium">Disbursement Balance</span>
      </div>

      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Disbursement Balance</h1>
        <p className="text-sm text-[#707975] mt-1">
          Selcom Infinity Disbursement account balance, and what it means for approved and pending settlement
          batches.
        </p>
      </div>

      <SelcomDisbursementBalanceCard
        snapshot={dashboard.snapshot}
        pendingApprovedPayoutsTotal={dashboard.pendingApprovedPayoutsTotal}
        reservedTotal={dashboard.reservedTotal}
        projectedBalance={dashboard.projectedBalance}
        lowBalance={dashboard.lowBalance}
        insufficientBalance={dashboard.insufficientBalance}
        history={dashboard.history}
        reservations={dashboard.reservations}
        environmentLabel={status.environmentRaw === 'sandbox' ? 'Sandbox' : 'Production'}
        environmentValid={status.environmentValid}
        canRefresh={canRefresh}
      />
    </div>
  );
}
