import { INQUIRY_STATUSES, labelFor } from '@/data/inquiries';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-[#e0f2ee] text-[#00342b]',
  contacted: 'bg-[#e5e7eb] text-[#374151]',
  in_discussion: 'bg-[#fef3e0] text-[#8a5a00]',
  proposal_sent: 'bg-[#e6e6fa] text-[#3d3d9e]',
  contract_review: 'bg-[#f2e6fa] text-[#6b2d8f]',
  offline_onboarding: 'bg-[#daf5ee] text-[#0f6b56]',
  active_client: 'bg-[#dcf5e3] text-[#1b7a3d]',
  rejected: 'bg-[#fbe4e4] text-[#8a1f1f]',
  dormant: 'bg-[#eeeeee] text-[#5a5f5c]',
};

export default function StatusBadge({ status }: { status: string }) {
  const colorClass = STATUS_COLORS[status] ?? 'bg-[#eeeeee] text-[#3f4945]';
  return (
    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${colorClass}`}>
      {labelFor(INQUIRY_STATUSES, status)}
    </span>
  );
}
