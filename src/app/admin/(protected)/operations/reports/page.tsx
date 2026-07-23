import { Download } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import AccessDenied from '@/components/admin/AccessDenied';

export const dynamic = 'force-dynamic';

const REPORTS = [
  { type: 'onboarding-pipeline', label: 'Onboarding Pipeline Report', description: 'Every onboarding case by stage, priority, and assigned owner.' },
  { type: 'contract-status', label: 'Contract Status Report', description: 'Every contract by status, value, and expiry.' },
  { type: 'project-delivery', label: 'Project Delivery Report', description: 'Every project by status, progress, and target date.' },
  { type: 'task-log', label: 'Operational Task Log', description: 'Every operational task by status, priority, and assignee.' },
] as const;

export default async function OperationsReportsPage() {
  try {
    await requirePermission('operations.reports.view');
  } catch {
    return <AccessDenied requiredPermission="operations.reports.view" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Operations Reports</h1>
        <p className="text-sm text-[#707975] mt-1">CSV exports, built from the same live data as the Operations pages.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORTS.map((report) => (
          <div key={report.type} className="bg-white border border-[#bfc9c4] p-5 flex flex-col justify-between">
            <div>
              <h2 className="font-semibold text-[#1b1c1c]">{report.label}</h2>
              <p className="text-sm text-[#707975] mt-1">{report.description}</p>
            </div>
            <a
              href={`/admin/operations/reports/export?type=${report.type}`}
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
