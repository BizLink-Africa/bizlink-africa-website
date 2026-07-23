import { CircleDashed } from 'lucide-react';

// Honest empty state for a dashboard section backed by a module that
// doesn't exist yet (Finance, Contracts, Compliance, Security, Marketing).
// Deliberately not a "coming soon" banner — it's the real section shell
// (same title, same layout) with a clear explanation instead of fabricated
// numbers, so the dashboard's structure doesn't change once the module ships.
export default function ModuleUnavailableCard({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="bg-white border border-dashed border-[#bfc9c4] p-6">
      <h2 className="font-semibold text-[#00342b] mb-3">{title}</h2>
      <div className="flex items-start gap-3 text-sm text-[#707975]">
        <CircleDashed size={16} className="mt-0.5 shrink-0" />
        <p>{reason}</p>
      </div>
    </div>
  );
}
