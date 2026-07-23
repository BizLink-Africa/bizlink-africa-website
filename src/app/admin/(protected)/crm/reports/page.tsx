import { Download } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import AccessDenied from '@/components/admin/AccessDenied';

export const dynamic = 'force-dynamic';

const REPORTS = [
  { type: 'lead-pipeline', label: 'Lead Pipeline Report', description: 'Every lead by stage, score, source, and assigned owner.' },
  { type: 'client-growth', label: 'Client Growth Report', description: 'Total and new clients over the last 90 days.' },
  { type: 'opportunity', label: 'Opportunity Report', description: 'Every opportunity by stage, value, and expected close date.' },
  { type: 'proposal-status', label: 'Proposal Status Report', description: 'Every proposal by status and value.' },
  { type: 'follow-up', label: 'Follow-up Report', description: 'Scheduled and completed follow-ups, with overdue flagged.' },
] as const;

export default async function CrmReportsPage() {
  try {
    await requirePermission('crm.reports.view');
  } catch {
    return <AccessDenied requiredPermission="crm.reports.view" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">CRM Reports</h1>
        <p className="text-sm text-[#707975] mt-1">CSV exports, built from the same live data as the CRM pages.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORTS.map((report) => (
          <div key={report.type} className="bg-white border border-[#bfc9c4] p-5 flex flex-col justify-between">
            <div>
              <h2 className="font-semibold text-[#1b1c1c]">{report.label}</h2>
              <p className="text-sm text-[#707975] mt-1">{report.description}</p>
            </div>
            <a
              href={`/admin/crm/reports/export?type=${report.type}`}
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
