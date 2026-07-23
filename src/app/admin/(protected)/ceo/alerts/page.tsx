import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import ExecutiveItemRow from '@/components/admin/ceo/ExecutiveItemRow';
import { getExecutiveActionItems, EXECUTIVE_CATEGORIES } from '@/lib/dashboard/executive-adapters';

export const dynamic = 'force-dynamic';

// Alert-flavored subset of the same shared aggregator used by the Action
// Center and Pending Approvals — security incidents, compliance issues, and
// failed integrations are "alerts" in the sense that they're system-raised
// problems rather than routine business approvals (contracts, expenses).
const ALERT_CATEGORIES = new Set<string>([
  EXECUTIVE_CATEGORIES.SECURITY_INCIDENTS,
  EXECUTIVE_CATEGORIES.COMPLIANCE_ISSUES,
  EXECUTIVE_CATEGORIES.FAILED_INTEGRATIONS,
]);

export default async function CompanyAlertsPage() {
  let canManage = true;
  try {
    await requirePermission('executive.alerts.view');
  } catch {
    return <AccessDenied requiredPermission="executive.alerts.view" />;
  }
  try {
    await requirePermission('executive.actions.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const items = (await getExecutiveActionItems(supabase)).filter((item) => ALERT_CATEGORIES.has(item.category));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/ceo" className="inline-flex items-center gap-1.5 text-sm text-[#00342b] hover:underline mb-3">
          <ArrowLeft size={14} /> Back to CEO Dashboard
        </Link>
        <h1 className="font-bold text-2xl text-[#00342b]">Company Alerts</h1>
        <p className="text-sm text-[#707975] mt-1">
          Security incidents, compliance issues, and failed integrations — {items.length} open.
        </p>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-5">
        {items.map((item) => (
          <ExecutiveItemRow key={`${item.module}-${item.id}`} item={item} canManage={canManage} />
        ))}
        {items.length === 0 && <p className="text-sm text-[#707975] py-6 text-center">No active alerts.</p>}
      </div>
    </div>
  );
}
