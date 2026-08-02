// "Production dashboard must show a clear LIVE badge" — a single,
// unmissable visual signal, reused everywhere the current Selcom
// environment is shown. environmentValid mirrors
// status.ts's getSelcomIntegrationStatus() — true for sandbox always,
// true for production only when SELCOM_PRODUCTION_ACTIVATION_ENABLED is
// also set. An environment reported as "production" but NOT valid means
// SELCOM_ENV=production was set without the required second flag — a
// misconfiguration, shown as a distinct warning state, never as LIVE.
export default function SelcomEnvironmentBadge({
  environmentRaw,
  environmentValid,
}: {
  environmentRaw: string;
  environmentValid: boolean;
}) {
  if (environmentRaw === 'production' && environmentValid) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full bg-red-600 text-white animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-white" />
        LIVE — REAL FUNDS
      </span>
    );
  }
  if (environmentRaw === 'production' && !environmentValid) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full bg-orange-100 text-[#8a5a00]">
        MISCONFIGURED — production requested but not activated
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-purple-50 text-purple-700">
      SANDBOX — no live funds
    </span>
  );
}
