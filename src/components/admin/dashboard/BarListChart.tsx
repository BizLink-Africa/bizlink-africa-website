export interface BarDatum {
  label: string;
  value: number;
}

// Single-series magnitude comparison — one brand hue for every bar, length
// + the direct value label carry the data. Generalized from the
// leads-by-stage chart so any module (support tickets by status,
// integrations by status, etc.) can reuse it.
export default function BarListChart({ title, data }: { title: string; data: BarDatum[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="bg-white border border-[#bfc9c4] p-6">
      <h2 className="font-semibold text-[#00342b] mb-5">{title}</h2>
      <div className="space-y-3">
        {data.map((d) => {
          const widthPct = (d.value / max) * 100;
          return (
            <div key={d.label} className="flex items-center gap-3 group -mx-2 px-2 py-0.5 rounded-sm hover:bg-[#f5f3f3] transition-colors">
              <span className="w-36 shrink-0 text-xs text-[#3f4945] text-right whitespace-nowrap">{d.label}</span>
              <div className="flex-1 flex items-center gap-2 h-4">
                <div
                  className="h-4 bg-[#1b7a3d] rounded-r-[4px] group-hover:bg-[#146030] transition-colors"
                  style={{ width: `${widthPct}%`, minWidth: d.value > 0 ? '4px' : '0px' }}
                />
                <span className="text-xs font-medium text-[#1b1c1c] tabular-nums">{d.value}</span>
              </div>
            </div>
          );
        })}
        {data.length === 0 && <p className="text-sm text-[#707975]">No data yet.</p>}
      </div>
    </div>
  );
}
