import { checkArchivedFinancialPrototypeAccess } from '@/lib/archived-financial-prototype';
import ArchivedModuleAccessDenied from '@/components/admin/ArchivedModuleAccessDenied';
import ArchivedPrototypeBanner from '@/components/admin/ArchivedPrototypeBanner';

// Archived financial prototype — collection/settlement/commission/payout
// reporting built on the retired payment-facilitator model. BizLink Africa
// does not receive, hold, reconcile, disburse or settle merchant funds.
// Preserved read-only for audit history, Super Admin only. See
// src/lib/archived-financial-prototype.ts.
export default async function FinancialReportsArchivedLayout({ children }: { children: React.ReactNode }) {
  const access = await checkArchivedFinancialPrototypeAccess();
  if (!access.ok) {
    return <ArchivedModuleAccessDenied reason={access.reason} module="financial_reports" />;
  }
  return (
    <div>
      <ArchivedPrototypeBanner />
      {children}
    </div>
  );
}
