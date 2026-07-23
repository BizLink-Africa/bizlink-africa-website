import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { ActionItem } from '@/lib/dashboard/types';
import ModuleUnavailableCard from './ModuleUnavailableCard';

const SEVERITY_STYLES: Record<ActionItem['severity'], string> = {
  low: 'bg-[#eeeeee] text-[#3f4945]',
  medium: 'bg-[#fdf1d6] text-[#8a6d1f]',
  high: 'bg-[#fbe2d5] text-[#a8481f]',
  critical: 'bg-[#fbdada] text-red-700',
};

export function ActionQueueGroup({ title, items, emptyLabel }: { title: string; items: ActionItem[]; emptyLabel: string }) {
  return (
    <div className="bg-white border border-[#bfc9c4] p-5">
      <h3 className="font-semibold text-[#1b1c1c] mb-3 text-sm">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-[#707975]">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-start gap-3 p-2 -mx-2 rounded-sm hover:bg-[#f5f3f3] transition-colors"
              >
                <span className={`shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${SEVERITY_STYLES[item.severity]}`}>
                  {item.severity}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[#1b1c1c] truncate">{item.title}</span>
                  <span className="block text-xs text-[#707975]">{item.detail}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ActionQueueUnavailableGroup({ title, reason }: { title: string; reason: string }) {
  return <ModuleUnavailableCard title={title} reason={reason} />;
}

export default function ActionQueueSection({ children, totalCount }: { children: React.ReactNode; totalCount: number }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={18} className="text-[#00342b]" />
        <h2 className="font-semibold text-[#00342b]">
          Executive Action Queue {totalCount > 0 && <span className="text-[#707975] font-normal">({totalCount})</span>}
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{children}</div>
    </div>
  );
}
