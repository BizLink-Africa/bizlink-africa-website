import { checkArchivedFinancialPrototypeAccess } from '@/lib/archived-financial-prototype';
import ArchivedModuleAccessDenied from '@/components/admin/ArchivedModuleAccessDenied';
import ArchivedPrototypeBanner from '@/components/admin/ArchivedPrototypeBanner';

// Archived financial prototype — merchant payout submission and approval.
// BizLink Africa does not receive, hold, disburse or settle merchant funds;
// settlement happens directly between each merchant and their approved
// payment partner. Preserved read-only for audit history, Super Admin only.
// See src/lib/archived-financial-prototype.ts. For non-financial,
// technical-only transaction visibility, see /admin/integration-health/transactions.
export default async function PayoutsArchivedLayout({ children }: { children: React.ReactNode }) {
  const access = await checkArchivedFinancialPrototypeAccess();
  if (!access.ok) {
    return <ArchivedModuleAccessDenied reason={access.reason} module="payouts" />;
  }
  return (
    <div>
      <ArchivedPrototypeBanner />
      {children}
    </div>
  );
}
