import Link from 'next/link';
import type { Kpi } from '@/lib/dashboard/types';

const ACCENT_TEXT: Record<NonNullable<Kpi['accent']>, string> = {
  default: 'text-[#00342b]',
  success: 'text-[#1b7a3d]',
  warning: 'text-[#8a6d1f]',
  danger: 'text-red-700',
};

const ACCENT_BORDER: Record<NonNullable<Kpi['accent']>, string> = {
  default: 'border-[#bfc9c4]',
  success: 'border-[#bfe5cc]',
  warning: 'border-[#eadfb0]',
  danger: 'border-red-200',
};

export default function KpiCard({ kpi }: { kpi: Kpi }) {
  const accent = kpi.accent ?? 'default';
  const content = (
    <div className={`bg-white border p-4 h-full ${ACCENT_BORDER[accent]} ${kpi.href ? 'hover:bg-[#f5f3f3] transition-colors' : ''}`}>
      <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider">{kpi.label}</p>
      <p className={`mt-1 font-bold text-2xl ${ACCENT_TEXT[accent]}`}>{kpi.value}</p>
    </div>
  );

  return kpi.href ? <Link href={kpi.href}>{content}</Link> : content;
}
