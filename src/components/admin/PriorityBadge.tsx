import { PRIORITY_LEVELS, labelFor } from '@/data/inquiries';

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-[#eeeeee] text-[#3f4945]',
  normal: 'bg-[#e0f2ee] text-[#00342b]',
  high: 'bg-[#fef3e0] text-[#8a5a00]',
  urgent: 'bg-[#fbe4e4] text-[#8a1f1f]',
};

export default function PriorityBadge({ priority }: { priority: string }) {
  const colorClass = PRIORITY_COLORS[priority] ?? 'bg-[#eeeeee] text-[#3f4945]';
  return (
    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${colorClass}`}>
      {labelFor(PRIORITY_LEVELS, priority)}
    </span>
  );
}
