import { labelFor, PROPOSAL_STATUSES } from '@/data/crm';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-[#eeeeee] text-[#3f4945]',
  pending_approval: 'bg-[#fef3e0] text-[#8a5a00]',
  approved: 'bg-[#e0f2ee] text-[#00342b]',
  sent: 'bg-[#e6e6fa] text-[#3d3d9e]',
  accepted: 'bg-[#dcf5e3] text-[#1b7a3d]',
  rejected: 'bg-[#fbe4e4] text-[#8a1f1f]',
  expired: 'bg-[#fbe4e4] text-[#8a1f1f]',
  converted: 'bg-[#dcf5e3] text-[#1b7a3d]',
};

export default function ProposalStatusBadge({ status }: { status: string }) {
  const colorClass = STATUS_COLORS[status] ?? 'bg-[#eeeeee] text-[#3f4945]';
  return (
    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${colorClass}`}>
      {labelFor(PROPOSAL_STATUSES, status)}
    </span>
  );
}
