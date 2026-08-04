import { checkArchivedFinancialPrototypeAccess } from '@/lib/archived-financial-prototype';
import ArchivedModuleAccessDenied from '@/components/admin/ArchivedModuleAccessDenied';
import ArchivedPrototypeBanner from '@/components/admin/ArchivedPrototypeBanner';

// Archived financial prototype — the Selcom disbursement account
// integration and its production/live-payout activation workflow. BizLink
// Africa does not receive, hold, disburse or settle merchant funds and has
// no disbursement account to activate for production. Preserved read-only
// for audit history, Super Admin only. See
// src/lib/archived-financial-prototype.ts.
export default async function SelcomDisbursementArchivedLayout({ children }: { children: React.ReactNode }) {
  const access = await checkArchivedFinancialPrototypeAccess();
  if (!access.ok) {
    return <ArchivedModuleAccessDenied reason={access.reason} module="selcom_disbursement" />;
  }
  return (
    <div>
      <ArchivedPrototypeBanner />
      {children}
    </div>
  );
}
