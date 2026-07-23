interface NotificationDatum {
  key: 'sent' | 'pending' | 'failed';
  label: string;
  value: number;
}

const COLORS: Record<NotificationDatum['key'], string> = {
  sent: '#1b7a3d',
  pending: '#707975',
  failed: '#a83232',
};

// Part-to-whole across a fixed total (every lead has exactly one
// notification_status) → single stacked bar. Three series, so a legend is
// mandatory (never color-alone) — validated as a set: CVD separation sits
// in the 8-12 floor band, which is only legal paired with direct labels,
// which the legend always provides.
export default function NotificationStatusChart({ data }: { data: NotificationDatum[] }) {
  const total = Math.max(1, data.reduce((sum, d) => sum + d.value, 0));

  return (
    <div className="bg-white border border-[#bfc9c4] p-6">
      <h2 className="font-semibold text-[#00342b] mb-5">Notification Status</h2>

      <div className="flex h-6 w-full overflow-hidden rounded-sm bg-[#eeeeee]">
        {data.map((d, i) => {
          const widthPct = (d.value / total) * 100;
          if (widthPct === 0) return null;
          return (
            <div
              key={d.key}
              className="h-full"
              style={{
                width: `${widthPct}%`,
                backgroundColor: COLORS[d.key],
                marginRight: i < data.length - 1 ? '2px' : undefined,
              }}
              title={`${d.label}: ${d.value}`}
            />
          );
        })}
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[d.key] }} />
            <span className="text-[#3f4945]">{d.label}</span>
            <span className="font-medium text-[#1b1c1c] tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
