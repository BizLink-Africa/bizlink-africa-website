import { checkArchivedFinancialPrototypeAccess } from '@/lib/archived-financial-prototype';
import ArchivedModuleAccessDenied from '@/components/admin/ArchivedModuleAccessDenied';
import ArchivedPrototypeBanner from '@/components/admin/ArchivedPrototypeBanner';

// Archived financial prototype — the collection ledger modeled BizLink as
// the party receiving merchant collections. BizLink Africa does not
// receive, hold, reconcile, disburse or settle merchant funds. Preserved
// read-only for audit history, Super Admin only. See
// src/lib/archived-financial-prototype.ts.
export default async function CollectionsArchivedLayout({ children }: { children: React.ReactNode }) {
  const access = await checkArchivedFinancialPrototypeAccess();
  if (!access.ok) {
    return <ArchivedModuleAccessDenied reason={access.reason} module="collections" />;
  }
  return (
    <div>
      <ArchivedPrototypeBanner />
      {children}
    </div>
  );
}
