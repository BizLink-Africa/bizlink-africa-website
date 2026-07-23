import type { TrendPoint } from '@/lib/dashboard/types';

const WIDTH = 600;
const HEIGHT = 160;
const PADDING = 24;

// Single-series trend over time (client growth, lead volume, etc.) — a line
// is the right form here since the sequence/direction of change is the
// point, not comparing discrete magnitudes (that's BarListChart's job).
export default function TrendLineChart({ title, data }: { title: string; data: TrendPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? (WIDTH - PADDING * 2) / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = PADDING + i * stepX;
    const y = HEIGHT - PADDING - (d.value / max) * (HEIGHT - PADDING * 2);
    return { x, y, ...d };
  });

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <div className="bg-white border border-[#bfc9c4] p-6">
      <h2 className="font-semibold text-[#00342b] mb-5">{title}</h2>
      {data.every((d) => d.value === 0) ? (
        <p className="text-sm text-[#707975]">No data yet.</p>
      ) : (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img" aria-label={title}>
          <path d={path} fill="none" stroke="#1b7a3d" strokeWidth={2} />
          {points.map((p) => (
            <g key={p.label}>
              <circle cx={p.x} cy={p.y} r={3} fill="#1b7a3d" />
              <text x={p.x} y={HEIGHT - 4} textAnchor="middle" fontSize={10} fill="#707975">
                {p.label}
              </text>
              <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={10} fill="#1b1c1c" fontWeight={600}>
                {p.value}
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}
