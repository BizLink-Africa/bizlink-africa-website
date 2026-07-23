import Link from 'next/link';
import type { ExecutiveActionItem } from '@/lib/dashboard/executive-adapters';
import ExecutiveItemControls from './ExecutiveItemControls';

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-[#eeeeee] text-[#3f4945]',
  normal: 'bg-[#e5e7eb] text-[#374151]',
  high: 'bg-[#fbe2d5] text-[#a8481f]',
  urgent: 'bg-[#fbdada] text-red-700',
};

// One row per aggregated item, shared by the Action Center, Pending
// Approvals, and Company Alerts pages. Real approve/reject/return decisions
// happen on the item's own page (linked via "View & Decide") using that
// domain's existing action component (ContractActionButtons,
// ExpenseApprovalButtons, etc.) — reusing those directly here would require
// re-fetching each domain's own status shape per row for no real benefit,
// since the buttons already live one click away (ExpenseApprovalQueueButtons,
// etc.). Comment/Assign/Escalate are genuinely new cross-cutting
// capabilities, so those ARE inline.
export default function ExecutiveItemRow({ item, canManage }: { item: ExecutiveActionItem; canManage: boolean }) {
  return (
    <div className="border-b border-[#e5e5e5] last:border-0 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${PRIORITY_STYLES[item.priority]}`}>
              {item.priority}
            </span>
            <span className="text-xs text-[#707975]">{item.department}</span>
          </div>
          <p className="text-sm font-medium text-[#1b1c1c] mt-1">{item.title}</p>
          <p className="text-xs text-[#707975]">{item.detail}</p>
          {item.deadline && <p className="text-xs text-[#8a5a00] mt-0.5">Deadline: {item.deadline}</p>}
        </div>
        <Link
          href={item.href}
          className="shrink-0 text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors whitespace-nowrap"
        >
          View &amp; Decide
        </Link>
      </div>
      {canManage && <ExecutiveItemControls module={item.module} id={item.id} title={item.title} href={item.href} />}
    </div>
  );
}
