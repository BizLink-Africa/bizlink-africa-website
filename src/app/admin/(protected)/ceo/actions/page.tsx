import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import ExecutiveItemRow from '@/components/admin/ceo/ExecutiveItemRow';
import ModuleUnavailableCard from '@/components/admin/dashboard/ModuleUnavailableCard';
import { getExecutiveActionItems, EXECUTIVE_UNAVAILABLE } from '@/lib/dashboard/executive-adapters';

export const dynamic = 'force-dynamic';

export default async function ExecutiveActionCenterPage() {
  let canManage = true;
  try {
    await requirePermission('executive.actions.view');
  } catch {
    return <AccessDenied requiredPermission="executive.actions.view" />;
  }
  try {
    await requirePermission('executive.actions.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const items = await getExecutiveActionItems(supabase);

  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    grouped.set(item.category, [...(grouped.get(item.category) ?? []), item]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <Link href="/admin/ceo" className="inline-flex items-center gap-1.5 text-sm text-[#00342b] hover:underline mb-3">
            <ArrowLeft size={14} /> Back to CEO Dashboard
          </Link>
          <h1 className="font-bold text-2xl text-[#00342b]">Executive Action Center</h1>
          <p className="text-sm text-[#707975] mt-1">
            Everything across the business that needs executive attention ({items.length}), in one place.
          </p>
        </div>
        <a
          href="/admin/ceo/actions/export"
          className="inline-flex items-center gap-2 border border-[#00342b] text-[#00342b] px-4 py-2 text-sm font-medium hover:bg-[#00342b] hover:text-white transition-colors"
        >
          <Download size={14} /> Export Decision History
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from(grouped.entries()).map(([category, categoryItems]) => (
          <div key={category} className="bg-white border border-[#bfc9c4] p-5">
            <h3 className="font-semibold text-[#1b1c1c] mb-1 text-sm">
              {category} <span className="text-[#707975] font-normal">({categoryItems.length})</span>
            </h3>
            <div>
              {categoryItems.map((item) => (
                <ExecutiveItemRow key={`${item.module}-${item.id}`} item={item} canManage={canManage} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-semibold text-[#00342b] mb-3">Not Yet Available</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EXECUTIVE_UNAVAILABLE.map((u) => (
            <ModuleUnavailableCard key={u.moduleLabel} title={u.moduleLabel} reason={u.reason} />
          ))}
        </div>
      </div>
    </div>
  );
}
