import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import ExecutiveItemRow from '@/components/admin/ceo/ExecutiveItemRow';
import PendingApprovalsFilters from '@/components/admin/ceo/PendingApprovalsFilters';
import { getExecutiveActionItems } from '@/lib/dashboard/executive-adapters';

export const dynamic = 'force-dynamic';

interface PageSearchParams {
  department?: string;
  actionType?: string;
  priority?: string;
  status?: string;
  from?: string;
  to?: string;
  deadlineBefore?: string;
  assignedTo?: string;
}

export default async function PendingApprovalsPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  let canManage = true;
  try {
    await requirePermission('executive.approvals.view');
  } catch {
    return <AccessDenied requiredPermission="executive.approvals.view" />;
  }
  try {
    await requirePermission('executive.approvals.manage');
  } catch {
    canManage = false;
  }

  const params = await searchParams;
  const supabase = await createClient();
  const [items, { data: followUps }] = await Promise.all([
    getExecutiveActionItems(supabase),
    supabase.from('executive_follow_ups').select('source_module, source_id, assigned_to, status'),
  ]);

  const followUpByKey = new Map((followUps ?? []).map((f) => [`${f.source_module}:${f.source_id}`, f]));

  let filtered = items;
  if (params.department) filtered = filtered.filter((i) => i.department === params.department);
  if (params.actionType) filtered = filtered.filter((i) => i.actionType === params.actionType);
  if (params.priority) filtered = filtered.filter((i) => i.priority === params.priority);
  if (params.from) filtered = filtered.filter((i) => i.submittedAt >= params.from!);
  if (params.to) filtered = filtered.filter((i) => i.submittedAt <= params.to!);
  if (params.deadlineBefore) filtered = filtered.filter((i) => i.deadline !== null && i.deadline <= params.deadlineBefore!);
  if (params.assignedTo) {
    filtered = filtered.filter((i) => followUpByKey.get(`${i.module}:${i.id}`)?.assigned_to === params.assignedTo);
  }
  if (params.status === 'unassigned') filtered = filtered.filter((i) => !followUpByKey.has(`${i.module}:${i.id}`));
  if (params.status === 'assigned') filtered = filtered.filter((i) => followUpByKey.get(`${i.module}:${i.id}`)?.status === 'open');
  if (params.status === 'done') filtered = filtered.filter((i) => followUpByKey.get(`${i.module}:${i.id}`)?.status === 'done');

  const departments = Array.from(new Set(items.map((i) => i.department))).sort();
  const actionTypes = Array.from(new Set(items.map((i) => i.actionType))).sort();
  const assignees = Array.from(new Set((followUps ?? []).map((f) => f.assigned_to).filter((a): a is string => Boolean(a)))).sort();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/ceo" className="inline-flex items-center gap-1.5 text-sm text-[#00342b] hover:underline mb-3">
          <ArrowLeft size={14} /> Back to CEO Dashboard
        </Link>
        <h1 className="font-bold text-2xl text-[#00342b]">Pending Approvals</h1>
        <p className="text-sm text-[#707975] mt-1">
          {filtered.length} of {items.length} item{items.length === 1 ? '' : 's'}
        </p>
      </div>

      <PendingApprovalsFilters departments={departments} actionTypes={actionTypes} assignees={assignees} />

      <div className="bg-white border border-[#bfc9c4] p-5">
        {filtered.map((item) => (
          <ExecutiveItemRow key={`${item.module}-${item.id}`} item={item} canManage={canManage} />
        ))}
        {filtered.length === 0 && <p className="text-sm text-[#707975] py-6 text-center">No items match these filters.</p>}
      </div>
    </div>
  );
}
