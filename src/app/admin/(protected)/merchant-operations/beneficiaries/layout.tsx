import { checkArchivedFinancialPrototypeAccess } from '@/lib/archived-financial-prototype';
import ArchivedModuleAccessDenied from '@/components/admin/ArchivedModuleAccessDenied';
import ArchivedPrototypeBanner from '@/components/admin/ArchivedPrototypeBanner';

// Archived financial prototype — merchant settlement beneficiary
// (bank/mobile-wallet destination) management, change requests, and
// Selcom account lookups. This module exists to prepare and verify a
// payout destination for BizLink-initiated disbursement — the confirmed
// operating model has each merchant supply and maintain their own
// settlement instructions directly with the approved payment partner, so
// BizLink Africa no longer needs to hold or manage this data for payout
// purposes. Preserved read-only for audit history, Super Admin only. Does
// not expose sensitive beneficiary details beyond what was already
// masked. See src/lib/archived-financial-prototype.ts.
export default async function BeneficiariesArchivedLayout({ children }: { children: React.ReactNode }) {
  const access = await checkArchivedFinancialPrototypeAccess();
  if (!access.ok) {
    return <ArchivedModuleAccessDenied reason={access.reason} module="merchant_beneficiaries" />;
  }
  return (
    <div>
      <ArchivedPrototypeBanner />
      {children}
    </div>
  );
}
