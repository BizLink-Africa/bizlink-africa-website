import { FlaskConical } from 'lucide-react';

// Prominent, reusable "this is not real money" label. Selcom's REAL
// sandbox API is called (signed HTTPS requests, real network round trips)
// — it just can never reach Selcom's production endpoint
// (src/lib/selcom/config.ts refuses to build a 'production' config). That
// distinction is exactly why this banner exists: "sandbox" here means
// something more consequential than the old fully-local mock adapter did,
// and staff should always be able to tell at a glance.
export default function SandboxBanner({ dense = false }: { dense?: boolean }) {
  return (
    <div className={`flex items-center gap-2 bg-[#fef3e0] border border-[#f0c988] text-[#8a5a00] font-semibold ${dense ? 'text-xs px-2.5 py-1' : 'text-sm px-4 py-2.5'}`}>
      <FlaskConical size={dense ? 12 : 15} className="shrink-0" />
      SANDBOX — NO LIVE FUNDS
    </div>
  );
}
