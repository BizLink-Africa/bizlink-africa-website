import { checkArchivedFinancialPrototypeAccess } from '@/lib/archived-financial-prototype';
import ArchivedModuleAccessDenied from '@/components/admin/ArchivedModuleAccessDenied';
import ArchivedPrototypeBanner from '@/components/admin/ArchivedPrototypeBanner';

// Archived financial prototype — settlement batches, disbursement balance,
// and payout approval workflow. BizLink Africa does not receive, hold,
// reconcile, disburse or settle merchant funds; settlement happens directly
// between each merchant and their approved payment partner. Preserved
// read-only for audit history, Super Admin only. See
// src/lib/archived-financial-prototype.ts.
export default async function SettlementArchivedLayout({ children }: { children: React.ReactNode }) {
  const access = await checkArchivedFinancialPrototypeAccess();
  if (!access.ok) {
    return <ArchivedModuleAccessDenied reason={access.reason} module="settlement" />;
  }
  return (
    <div>
      <ArchivedPrototypeBanner />
      {children}
    </div>
  );
}
