import { NOTIFICATION_STATUS_OPTIONS, labelFor } from '@/data/inquiries';

const NOTIFICATION_COLORS: Record<string, string> = {
  pending: 'bg-[#eeeeee] text-[#3f4945]',
  sent: 'bg-[#dcf5e3] text-[#1b7a3d]',
  failed: 'bg-[#fbe4e4] text-[#8a1f1f]',
};

export default function NotificationBadge({ status, title }: { status: string; title?: string }) {
  const colorClass = NOTIFICATION_COLORS[status] ?? 'bg-[#eeeeee] text-[#3f4945]';
  return (
    <span
      title={title}
      className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${colorClass}`}
    >
      {labelFor(NOTIFICATION_STATUS_OPTIONS, status)}
    </span>
  );
}
