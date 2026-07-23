import { Download } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import AccessDenied from '@/components/admin/AccessDenied';

export const dynamic = 'force-dynamic';

const REPORTS = [
  { type: 'reviews', label: 'Compliance Reviews Report', description: 'Every review, its type, officer, risk level, and status.' },
  { type: 'client-compliance', label: 'Client Compliance Report', description: 'Every client’s compliance status, risk level, and next review date.' },
  { type: 'contract-compliance', label: 'Contract Compliance Report', description: 'Every contract’s review/approval status and findings.' },
  { type: 'data-protection', label: 'Data Protection Report', description: 'Every processing activity, legal basis, retention, and risk.' },
  { type: 'policy-acknowledgements', label: 'Policy Acknowledgement Report', description: 'Every policy acknowledgement on record.' },
  { type: 'access-reviews', label: 'Access Review Report', description: 'Every access review decision and excessive-access flag.' },
] as const;

export default async function ComplianceReportsPage() {
  try {
    await requirePermission('compliance.reports.view');
  } catch {
    return <AccessDenied requiredPermission="compliance.reports.view" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Compliance Reports</h1>
        <p className="text-sm text-[#707975] mt-1">CSV exports, built from the same live data as the Compliance pages.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORTS.map((report) => (
          <div key={report.type} className="bg-white border border-[#bfc9c4] p-5 flex flex-col justify-between">
            <div>
              <h2 className="font-semibold text-[#1b1c1c]">{report.label}</h2>
              <p className="text-sm text-[#707975] mt-1">{report.description}</p>
            </div>
            <a
              href={`/admin/compliance/reports/export?type=${report.type}`}
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
