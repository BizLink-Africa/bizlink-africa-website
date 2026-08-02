import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import AccessDenied from '@/components/admin/AccessDenied';

export const dynamic = 'force-dynamic';

const REPORTS = [
  { href: '/admin/financial-reports/statements', label: 'Merchant Statements', description: 'Per-merchant settlement statement for a chosen period, with CSV and PDF export.' },
  { href: '/admin/financial-reports/daily-collections', label: 'Daily Collections', description: 'Gross, fees, commission and net collected per day per merchant.' },
  { href: '/admin/financial-reports/daily-reconciliation', label: 'Daily Reconciliation', description: 'Every reconciliation run, its variance, and approval status.' },
  { href: '/admin/financial-reports/merchant-settlement', label: 'Merchant Settlement', description: 'Settlement batches and their per-merchant lines.' },
  { href: '/admin/financial-reports/commission-revenue', label: 'Commission Revenue', description: 'BizLink commission earned per day per merchant.' },
  { href: '/admin/financial-reports/outstanding-liabilities', label: 'Outstanding Merchant Liabilities', description: 'Unsettled net balances owed to merchants right now.' },
  { href: '/admin/financial-reports/failed-payouts', label: 'Failed Payouts', description: 'Payout attempts the sandbox/live adapter reported as failed.' },
  { href: '/admin/financial-reports/chargebacks-reversals', label: 'Chargebacks & Reversals', description: 'Dispute cases and manual reversal requests.' },
  { href: '/admin/financial-reports/settlement-holds', label: 'Settlement Holds', description: 'Every hold ever placed, active and released.' },
  { href: '/admin/financial-reports/beneficiary-changes', label: 'Beneficiary Changes', description: 'Requested and reviewed settlement beneficiary changes.' },
  { href: '/admin/financial-reports/merchant-kyc-status', label: 'Merchant KYC Status', description: 'Onboarding and KYC decision status per merchant.' },
  { href: '/admin/financial-reports/audit-trail', label: 'Financial Audit Trail', description: 'Every finance/compliance-relevant audit log entry.' },
];

export default async function FinancialReportsIndexPage() {
  try {
    await requirePermission('financial_reports.view');
  } catch {
    return <AccessDenied requiredPermission="financial_reports.view" />;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Financial Reports</h1>
        <p className="text-sm text-[#707975] mt-1">
          Super Admin / authorised Finance only. Every export is logged. No report discloses partner processing rates.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href} className="block bg-white border border-[#bfc9c4] p-5 hover:border-[#00342b] transition-colors">
            <p className="font-semibold text-[#00342b]">{r.label}</p>
            <p className="text-xs text-[#707975] mt-1">{r.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
