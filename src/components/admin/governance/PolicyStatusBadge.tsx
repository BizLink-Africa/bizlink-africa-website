import { labelFor } from '@/data/governance';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-[#eeeeee] text-[#3f4945]',
  active: 'bg-[#dcf5e3] text-[#1b7a3d]',
  archived: 'bg-[#eeeeee] text-[#5a5f5c]',
};

export default function PolicyStatusBadge({ status, list }: { status: string; list: readonly { value: string; label: string }[] }) {
  const colorClass = STATUS_COLORS[status] ?? 'bg-[#eeeeee] text-[#3f4945]';
  return (
    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${colorClass}`}>
      {labelFor(list, status)}
    </span>
  );
}
