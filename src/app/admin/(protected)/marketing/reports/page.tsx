import { Download } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import AccessDenied from '@/components/admin/AccessDenied';

export const dynamic = 'force-dynamic';

const REPORTS = [
  { type: 'campaign-performance', label: 'Campaign Performance', description: 'Every campaign with budget, spend, and live-attributed leads/conversions/revenue.' },
  { type: 'lead-source', label: 'Lead Source Report', description: 'Every lead by source, MQL/SQL qualification, and stage.' },
  { type: 'content-calendar', label: 'Content Calendar Report', description: 'Every content item with status, approval status, and performance notes.' },
  { type: 'social-media', label: 'Social Media Report', description: 'Every logged post with reach, engagement, clicks, leads, and conversions.' },
  { type: 'email-campaigns', label: 'Email Campaigns Report', description: 'Every email campaign with delivery/open/click rates and outcomes.' },
  { type: 'referrals-partnerships', label: 'Referrals & Partnerships Report', description: 'Every referrer/partner with live-attributed leads/conversions/revenue.' },
  { type: 'landing-pages', label: 'Landing Pages Report', description: 'Every landing page with visits, submissions, and conversion rate.' },
] as const;

export default async function MarketingReportsPage() {
  try {
    await requirePermission('marketing.reports.view');
  } catch {
    return <AccessDenied requiredPermission="marketing.reports.view" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Marketing Reports</h1>
        <p className="text-sm text-[#707975] mt-1">CSV exports, built from the same live data as the Marketing pages.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORTS.map((report) => (
          <div key={report.type} className="bg-white border border-[#bfc9c4] p-5 flex flex-col justify-between">
            <div>
              <h2 className="font-semibold text-[#1b1c1c]">{report.label}</h2>
              <p className="text-sm text-[#707975] mt-1">{report.description}</p>
            </div>
            <a
              href={`/admin/marketing/reports/export?type=${report.type}`}
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
