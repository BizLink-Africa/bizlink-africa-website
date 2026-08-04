import { checkArchivedFinancialPrototypeAccess } from '@/lib/archived-financial-prototype';
import ArchivedModuleAccessDenied from '@/components/admin/ArchivedModuleAccessDenied';
import ArchivedPrototypeBanner from '@/components/admin/ArchivedPrototypeBanner';

// Archived financial prototype — commission/fee rules deducted from
// merchant collections. BizLink Africa does not receive, hold, reconcile,
// disburse or settle merchant funds, so this module no longer applies to
// production operations. Preserved read-only for audit history, Super
// Admin only. See src/lib/archived-financial-prototype.ts.
export default async function CommissionRulesArchivedLayout({ children }: { children: React.ReactNode }) {
  const access = await checkArchivedFinancialPrototypeAccess();
  if (!access.ok) {
    return <ArchivedModuleAccessDenied reason={access.reason} module="commission_rules" />;
  }
  return (
    <div>
      <ArchivedPrototypeBanner />
      {children}
    </div>
  );
}
