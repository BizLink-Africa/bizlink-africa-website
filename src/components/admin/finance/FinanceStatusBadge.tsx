import { labelFor } from '@/data/finance';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-[#eeeeee] text-[#3f4945]',
  submitted: 'bg-[#e5e7eb] text-[#374151]',
  pending_approval: 'bg-[#fef3e0] text-[#8a5a00]',
  approved: 'bg-[#e0f2ee] text-[#00342b]',
  sent: 'bg-[#e6e6fa] text-[#3d3d9e]',
  issued: 'bg-[#e6e6fa] text-[#3d3d9e]',
  accepted: 'bg-[#dcf5e3] text-[#1b7a3d]',
  approved_paid: 'bg-[#dcf5e3] text-[#1b7a3d]',
  paid: 'bg-[#dcf5e3] text-[#1b7a3d]',
  partially_paid: 'bg-[#fef3e0] text-[#8a5a00]',
  rejected: 'bg-[#fbe4e4] text-[#8a1f1f]',
  overdue: 'bg-[#fbe4e4] text-[#8a1f1f]',
  expired: 'bg-[#fbe4e4] text-[#8a1f1f]',
  converted: 'bg-[#dcf5e3] text-[#1b7a3d]',
  cancelled: 'bg-[#eeeeee] text-[#5a5f5c]',
  written_off: 'bg-[#eeeeee] text-[#5a5f5c]',
};

export default function FinanceStatusBadge({ status, list }: { status: string; list: readonly { value: string; label: string }[] }) {
  const colorClass = STATUS_COLORS[status] ?? 'bg-[#eeeeee] text-[#3f4945]';
  return (
    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${colorClass}`}>
      {labelFor(list, status)}
    </span>
  );
}
