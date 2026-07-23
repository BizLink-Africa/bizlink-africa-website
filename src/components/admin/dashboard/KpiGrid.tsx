import type { Kpi } from '@/lib/dashboard/types';
import KpiCard from './KpiCard';

export default function KpiGrid({ title, kpis }: { title?: string; kpis: Kpi[] }) {
  return (
    <div>
      {title && <h2 className="font-semibold text-[#00342b] mb-3">{title}</h2>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} />
        ))}
      </div>
    </div>
  );
}
