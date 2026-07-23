import { Download } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import AccessDenied from '@/components/admin/AccessDenied';

export const dynamic = 'force-dynamic';

const REPORTS = [
  { type: 'roles', label: 'Roles & Permissions Report', description: 'Every role, its type, status, and how many staff are assigned.' },
  { type: 'departments', label: 'Departments Report', description: 'Every department, manager, staff count, and status.' },
  { type: 'policies', label: 'Policies Report', description: 'Every governance policy document, version, owner, and status.' },
  { type: 'approval-workflows', label: 'Approval Workflows Report', description: 'Every configured workflow and its approver role.' },
  { type: 'access-reviews', label: 'Staff Access Reviews Report', description: 'Every access review decision and excessive-access flag.' },
] as const;

export default async function GovernanceReportsPage() {
  try {
    await requirePermission('governance.reports.view');
  } catch {
    return <AccessDenied requiredPermission="governance.reports.view" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Governance Reports</h1>
        <p className="text-sm text-[#707975] mt-1">CSV exports, built from the same live data as the Governance pages.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORTS.map((report) => (
          <div key={report.type} className="bg-white border border-[#bfc9c4] p-5 flex flex-col justify-between">
            <div>
              <h2 className="font-semibold text-[#1b1c1c]">{report.label}</h2>
              <p className="text-sm text-[#707975] mt-1">{report.description}</p>
            </div>
            <a
              href={`/admin/governance/reports/export?type=${report.type}`}
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
