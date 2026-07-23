import { labelFor } from '@/data/compliance';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-[#eeeeee] text-[#3f4945]',
  in_review: 'bg-[#fef3e0] text-[#8a5a00]',
  compliant: 'bg-[#dcf5e3] text-[#1b7a3d]',
  non_compliant: 'bg-[#fbe4e4] text-[#8a1f1f]',
  remediation_required: 'bg-[#fbe4e4] text-[#8a1f1f]',
};

export default function ComplianceStatusBadge({ status, list }: { status: string; list: readonly { value: string; label: string }[] }) {
  const colorClass = STATUS_COLORS[status] ?? 'bg-[#eeeeee] text-[#3f4945]';
  return (
    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${colorClass}`}>
      {labelFor(list, status)}
    </span>
  );
}
