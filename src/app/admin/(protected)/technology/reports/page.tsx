import { Download } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import AccessDenied from '@/components/admin/AccessDenied';

export const dynamic = 'force-dynamic';

const REPORTS = [
  { type: 'integration-health', label: 'Integration Health Report', description: 'Every integration, its status, success rate, response time, and technical owner.' },
  { type: 'api-requests', label: 'API Request Report', description: 'Recent API requests with response codes, response time, and error category (endpoints masked).' },
  { type: 'webhook-deliveries', label: 'Webhook Delivery Report', description: 'Every webhook delivery attempt, its status, and retry count.' },
  { type: 'deployments', label: 'Deployment Report', description: 'Every deployment, its status, and rollback outcome.' },
  { type: 'background-jobs', label: 'Background Jobs Report', description: 'Job runs by queue, status, and retry count.' },
  { type: 'incidents', label: 'Technical Incidents Report', description: 'Every incident, severity, status, and time to resolution.' },
  { type: 'ai-agents', label: 'AI Agent Report', description: 'Every configured AI agent, its status, channel, and usage.' },
] as const;

export default async function TechnicalReportsPage() {
  try {
    await requirePermission('technology.reports.view');
  } catch {
    return <AccessDenied requiredPermission="technology.reports.view" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Technical Reports</h1>
        <p className="text-sm text-[#707975] mt-1">CSV exports, built from the same live data as the Technology pages.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORTS.map((report) => (
          <div key={report.type} className="bg-white border border-[#bfc9c4] p-5 flex flex-col justify-between">
            <div>
              <h2 className="font-semibold text-[#1b1c1c]">{report.label}</h2>
              <p className="text-sm text-[#707975] mt-1">{report.description}</p>
            </div>
            <a
              href={`/admin/technology/reports/export?type=${report.type}`}
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
