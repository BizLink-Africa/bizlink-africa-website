import { Download } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import AccessDenied from '@/components/admin/AccessDenied';

export const dynamic = 'force-dynamic';

const REPORTS = [
  { type: 'security-events', label: 'Security Events Report', description: 'Every logged event, severity, and investigation status (descriptions masked).' },
  { type: 'security-incidents', label: 'Security Incidents Report', description: 'Every incident, severity, and time to resolution (containment/resolution masked).' },
  { type: 'sessions', label: 'Session Report', description: 'Every tracked session and its revoke status.' },
  { type: 'logins', label: 'Login Activity Report', description: 'Every login attempt, success/failure, and source IP.' },
] as const;

export default async function SecurityReportsPage() {
  try {
    await requirePermission('security.reports.view');
  } catch {
    return <AccessDenied requiredPermission="security.reports.view" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Security Reports</h1>
        <p className="text-sm text-[#707975] mt-1">CSV exports, built from the same live data as the Security pages. Free-text fields are masked — never full secrets.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORTS.map((report) => (
          <div key={report.type} className="bg-white border border-[#bfc9c4] p-5 flex flex-col justify-between">
            <div>
              <h2 className="font-semibold text-[#1b1c1c]">{report.label}</h2>
              <p className="text-sm text-[#707975] mt-1">{report.description}</p>
            </div>
            <a
              href={`/admin/security/reports/export?type=${report.type}`}
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
