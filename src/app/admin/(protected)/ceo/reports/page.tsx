import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import AccessDenied from '@/components/admin/AccessDenied';

export const dynamic = 'force-dynamic';

const REPORTS = [
  { type: 'company-performance', label: 'Company Performance Report', description: 'Revenue, clients, leads, and department activity in one export.' },
  { type: 'revenue', label: 'Revenue Report', description: 'Monthly/annual revenue, receivables, and proforma pipeline.' },
  { type: 'operations', label: 'Operations Report', description: 'Onboarding, contracts, and service delivery status.' },
  { type: 'client-growth', label: 'Client Growth Report', description: 'Total, active, and new clients over the selected period.' },
  { type: 'department-performance', label: 'Department Performance Report', description: 'Open executive items by department.' },
  { type: 'risk-alerts', label: 'Risk & Alert Report', description: 'Security incidents, compliance issues, and overdue invoices.' },
  { type: 'contract-status', label: 'Contract Status Report', description: 'Every contract by status, with expiry flags.' },
  { type: 'support-escalation', label: 'Support Escalation Report', description: 'Open and critical support tickets.' },
] as const;

export default async function ExecutiveReportsPage() {
  try {
    await requirePermission('executive.reports.view');
  } catch {
    return <AccessDenied requiredPermission="executive.reports.view" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/ceo" className="inline-flex items-center gap-1.5 text-sm text-[#00342b] hover:underline mb-3">
          <ArrowLeft size={14} /> Back to CEO Dashboard
        </Link>
        <h1 className="font-bold text-2xl text-[#00342b]">Executive Reports</h1>
        <p className="text-sm text-[#707975] mt-1">
          CSV exports, built from the same live data as the dashboards — never a separate reporting pipeline.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORTS.map((report) => (
          <div key={report.type} className="bg-white border border-[#bfc9c4] p-5 flex flex-col justify-between">
            <div>
              <h2 className="font-semibold text-[#1b1c1c]">{report.label}</h2>
              <p className="text-sm text-[#707975] mt-1">{report.description}</p>
            </div>
            <a
              href={`/admin/ceo/reports/export?type=${report.type}`}
              className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors w-fit"
            >
              <Download size={14} /> Export CSV
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
