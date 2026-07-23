import { labelFor, SECURITY_SEVERITIES } from '@/data/compliance';

const SEVERITY_COLORS: Record<string, string> = {
  info: 'bg-[#e0f2ee] text-[#00342b]',
  warning: 'bg-[#fef3e0] text-[#8a5a00]',
  critical: 'bg-[#fbe4e4] text-[#8a1f1f]',
};

export default function SecuritySeverityBadge({ severity }: { severity: string }) {
  const colorClass = SEVERITY_COLORS[severity] ?? 'bg-[#eeeeee] text-[#3f4945]';
  return (
    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${colorClass}`}>
      {labelFor(SECURITY_SEVERITIES, severity)}
    </span>
  );
}
