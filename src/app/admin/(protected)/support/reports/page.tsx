import { Download } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import AccessDenied from '@/components/admin/AccessDenied';

export const dynamic = 'force-dynamic';

const REPORTS = [
  { type: 'ticket-volume', label: 'Ticket Volume Report', description: 'Every ticket by status, priority, and category.' },
  { type: 'sla-compliance', label: 'SLA Compliance Report', description: 'Every ticket with response/resolution deadlines and whether they were met or breached.' },
  { type: 'agent-performance', label: 'Agent Performance Report', description: 'Tickets handled, resolved, and average CSAT per agent.' },
  { type: 'resolution-time', label: 'Resolution Time Report', description: 'First-response and resolution time (hours) for every resolved ticket.' },
  { type: 'csat', label: 'Customer Satisfaction Report', description: 'Every recorded rating and feedback.' },
  { type: 'escalation', label: 'Escalation Report', description: 'Every escalated ticket, its target, and reason.' },
  { type: 'category', label: 'Category Report', description: 'Ticket counts and average resolution time by category.' },
] as const;

export default async function SupportReportsPage() {
  try {
    await requirePermission('support.reports.view');
  } catch {
    return <AccessDenied requiredPermission="support.reports.view" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Support Reports</h1>
        <p className="text-sm text-[#707975] mt-1">CSV exports, built from the same live data as the Support pages.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORTS.map((report) => (
          <div key={report.type} className="bg-white border border-[#bfc9c4] p-5 flex flex-col justify-between">
            <div>
              <h2 className="font-semibold text-[#1b1c1c]">{report.label}</h2>
              <p className="text-sm text-[#707975] mt-1">{report.description}</p>
            </div>
            <a
              href={`/admin/support/reports/export?type=${report.type}`}
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
