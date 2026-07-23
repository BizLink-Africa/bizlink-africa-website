import { labelFor } from '@/data/marketing';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-[#eeeeee] text-[#3f4945]',
  scheduled: 'bg-[#e6e6fa] text-[#3d3d9e]',
  active: 'bg-[#dcf5e3] text-[#1b7a3d]',
  paused: 'bg-[#fef3e0] text-[#8a5a00]',
  completed: 'bg-[#e0f2ee] text-[#00342b]',
  cancelled: 'bg-[#eeeeee] text-[#5a5f5c]',
};

export default function CampaignStatusBadge({ status, list }: { status: string; list: readonly { value: string; label: string }[] }) {
  const colorClass = STATUS_COLORS[status] ?? 'bg-[#eeeeee] text-[#3f4945]';
  return (
    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${colorClass}`}>
      {labelFor(list, status)}
    </span>
  );
}
