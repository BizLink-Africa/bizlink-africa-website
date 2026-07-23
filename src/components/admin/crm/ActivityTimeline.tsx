import type { ActivityEntry } from '@/lib/audit';

function summarize(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  return Object.entries(value as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(', ');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function ActivityTimeline({ entries }: { entries: ActivityEntry[] }) {
  return (
    <div className="bg-white border border-[#bfc9c4] p-5">
      <h2 className="font-semibold text-[#1b1c1c] mb-3 text-sm">Activity History</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-[#707975]">No activity recorded yet.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => {
            const detail = summarize(entry.new_value);
            return (
              <li key={entry.id} className="border-b border-[#e5e5e5] last:border-0 pb-3 last:pb-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-[#00342b] uppercase tracking-wider">
                    {entry.action_type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-[#707975]">{formatDate(entry.created_at)}</span>
                </div>
                <p className="text-xs text-[#707975] mt-0.5">by {entry.performed_by}</p>
                {detail && <p className="text-sm text-[#3f4945] mt-1">{detail}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
