import { checkArchivedFinancialPrototypeAccess } from '@/lib/archived-financial-prototype';
import ArchivedModuleAccessDenied from '@/components/admin/ArchivedModuleAccessDenied';
import ArchivedPrototypeBanner from '@/components/admin/ArchivedPrototypeBanner';

// Archived financial prototype — the entire Chargebacks & Holds module
// (cases, evidence, resolution, recovery, settlement holds, and manual
// reversals). Opening a new chargeback case fundamentally depends on
// collection_transactions — BizLink's own record of merchant collections —
// which is itself archived, since BizLink Africa does not receive, hold,
// reconcile, disburse or settle merchant funds. Manual reversals write
// directly against that same archived collection ledger. Chargebacks and
// reversal disputes are now a matter between the merchant and their
// approved payment partner. Preserved read-only for audit history, Super
// Admin only. See src/lib/archived-financial-prototype.ts. This
// supersedes the narrower chargebacks/holds-only gate that previously
// applied to just this subtree — the whole module is archived now, not
// just settlement holds.
export default async function ChargebacksArchivedLayout({ children }: { children: React.ReactNode }) {
  const access = await checkArchivedFinancialPrototypeAccess();
  if (!access.ok) {
    return <ArchivedModuleAccessDenied reason={access.reason} module="chargebacks" />;
  }
  return (
    <div>
      <ArchivedPrototypeBanner />
      {children}
    </div>
  );
}
