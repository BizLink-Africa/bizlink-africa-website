import 'server-only';

// Every env var this app actually reads (see .env.example for what each
// one is for). Keeping this list here — not just in .env.example — means a
// missing production secret fails loudly and immediately instead of
// surfacing later as a confusing runtime error deep inside some unrelated
// feature (e.g. a silently-undefined SUPABASE_SERVICE_ROLE_KEY producing a
// cryptic Supabase client error instead of "you forgot to set this").
const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_ADMIN_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'BIZLINK_NOTIFICATION_EMAIL',
  'PROVISIONING_ENCRYPTION_KEY',
  'BENEFICIARY_ENCRYPTION_KEY',
] as const;

// Only enforced in the real Vercel production environment (VERCEL_ENV is
// 'production' only for that one deployment — preview deployments get
// 'preview', `next dev` gets nothing at all) — local dev and preview
// deployments are allowed to run with a partial .env.local while features
// are still being built out.
export function assertRequiredEnvVars(): void {
  if (process.env.VERCEL_ENV !== 'production') return;

  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variable(s): ${missing.join(', ')}`);
  }
}
