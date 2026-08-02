import 'server-only';
import { createPrivateKey } from 'node:crypto';
import { SelcomConfigError } from './errors';
import type { SelcomConfig, SelcomEnv } from './types';

// Every env var this integration reads for the SANDBOX credential set
// (validated eagerly, not just listed — see src/lib/env.ts's
// REQUIRED_ENV_VARS for the same convention). These names are unprefixed
// for historical reasons (this integration was sandbox-only for most of
// its life) — treat them as the sandbox set exactly as if they were named
// SELCOM_SANDBOX_*. Never reused for production: see
// REQUIRED_PRODUCTION_SELCOM_ENV_VARS below for that fully separate set.
// "Sandbox and production credentials must be stored separately" is
// enforced by these being two disjoint env var names, not two modes of
// the same name.
const REQUIRED_SELCOM_ENV_VARS = [
  'SELCOM_SANDBOX_BASE_URL',
  'SELCOM_API_KEY',
  'SELCOM_RSA_PRIVATE_KEY',
  'SELCOM_DISBURSEMENT_ACCOUNT',
  'SELCOM_CALLBACK_SECRET',
  'SELCOM_CALLBACK_URL',
] as const;

// The fully separate production credential set. Every one of these must
// be its own distinct secret in Vercel/an approved secret manager — never
// the sandbox value reused, and never present in a local .env file (see
// .env.example's comments and .gitignore's blanket `.env*` exclusion).
const REQUIRED_PRODUCTION_SELCOM_ENV_VARS = [
  'SELCOM_PRODUCTION_BASE_URL',
  'SELCOM_PRODUCTION_API_KEY',
  'SELCOM_PRODUCTION_RSA_PRIVATE_KEY',
  'SELCOM_PRODUCTION_DISBURSEMENT_ACCOUNT',
  'SELCOM_PRODUCTION_CALLBACK_SECRET',
  'SELCOM_PRODUCTION_CALLBACK_URL',
] as const;

// Env vars frequently arrive with literal "\n" escape sequences instead of
// real newlines (Vercel's env var UI, .env files that can't hold multiline
// values cleanly) — normalize before handing the PEM to node:crypto.
function normalizePrivateKey(raw: string): string {
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

let cachedConfig: SelcomConfig | null = null;

// "Production activation must be disabled by default" / "Only one
// authorised deployment configuration can enable production": SELCOM_ENV
// alone is not enough to go live — a SEPARATE, independently-set
// deployment flag must also be explicitly "true". The two are meant to be
// set together on exactly one Vercel environment (Production), never on
// Preview or a developer's local .env — anyone who can set one env var
// can typically set both, but requiring two independent, differently-named
// flags means a single copy-pasted "SELCOM_ENV=production" (e.g. into a
// preview deployment while debugging) can never silently go live.
function isProductionActivationEnabled(): boolean {
  return (process.env.SELCOM_PRODUCTION_ACTIVATION_ENABLED ?? '').trim().toLowerCase() === 'true';
}

// Resolves which environment this process is configured for. Deliberately
// does NOT check credential presence (that's buildConfig()'s job) — this
// is also called from contexts that only need to know "sandbox or
// production" without needing full Selcom credentials to be configured
// (e.g. stamping merchant_payouts.environment at payout-creation time,
// long before any Selcom API call happens).
export function resolveSelcomEnvironment(): SelcomEnv {
  const raw = (process.env.SELCOM_ENV ?? 'sandbox').trim().toLowerCase();
  if (raw !== 'sandbox' && raw !== 'production') {
    throw new SelcomConfigError(`SELCOM_ENV must be "sandbox" or "production", got: "${raw}"`);
  }
  if (raw === 'production' && !isProductionActivationEnabled()) {
    throw new SelcomConfigError(
      'SELCOM_ENV=production requires SELCOM_PRODUCTION_ACTIVATION_ENABLED=true to also be set. ' +
        'This is a deliberate, separate deployment-level gate — do not activate production automatically. ' +
        'Both must be set together only on the one authorised production deployment configuration, ' +
        'and only after the production readiness checklist has been completed and Finance/Compliance ' +
        'approval recorded (Administration -> Integrations -> Disbursement API -> Production Readiness).'
    );
  }
  return raw;
}

function buildConfig(): SelcomConfig {
  const env = resolveSelcomEnvironment();

  const requiredVars: readonly string[] = env === 'production' ? REQUIRED_PRODUCTION_SELCOM_ENV_VARS : REQUIRED_SELCOM_ENV_VARS;
  const missing = requiredVars.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new SelcomConfigError(`Missing required Selcom environment variable(s) for ${env}: ${missing.join(', ')}`);
  }

  const rawPrivateKey = env === 'production' ? process.env.SELCOM_PRODUCTION_RSA_PRIVATE_KEY! : process.env.SELCOM_RSA_PRIVATE_KEY!;
  const privateKeyPem = normalizePrivateKey(rawPrivateKey);

  // Fail fast on a malformed key here, at config load, rather than inside
  // signer.ts on the first real request. Never include the key or any
  // parse-error detail that might echo key bytes in the thrown message.
  try {
    createPrivateKey(privateKeyPem);
  } catch {
    throw new SelcomConfigError(
      env === 'production' ? 'SELCOM_PRODUCTION_RSA_PRIVATE_KEY is not a valid PEM private key.' : 'SELCOM_RSA_PRIVATE_KEY is not a valid PEM private key.'
    );
  }

  const baseUrl = env === 'sandbox' ? process.env.SELCOM_SANDBOX_BASE_URL! : process.env.SELCOM_PRODUCTION_BASE_URL!;

  return {
    env,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey: env === 'production' ? process.env.SELCOM_PRODUCTION_API_KEY! : process.env.SELCOM_API_KEY!,
    privateKeyPem,
    disbursementAccount: env === 'production' ? process.env.SELCOM_PRODUCTION_DISBURSEMENT_ACCOUNT! : process.env.SELCOM_DISBURSEMENT_ACCOUNT!,
    callbackSecret: env === 'production' ? process.env.SELCOM_PRODUCTION_CALLBACK_SECRET! : process.env.SELCOM_CALLBACK_SECRET!,
    callbackUrl: env === 'production' ? process.env.SELCOM_PRODUCTION_CALLBACK_URL! : process.env.SELCOM_CALLBACK_URL!,
  };
}

// Memoized per process — env vars don't change at runtime. Every Selcom
// function call goes through this, so validation happens on first use, not
// at module load (which would run during builds/tests that never touch
// Selcom and shouldn't be forced to configure it).
export function getSelcomConfig(): SelcomConfig {
  if (!cachedConfig) {
    cachedConfig = buildConfig();
  }
  return cachedConfig;
}

// Test-only escape hatch so config tests can exercise buildConfig() under
// different process.env values without cross-test pollution.
export function resetSelcomConfigCacheForTests(): void {
  cachedConfig = null;
}
