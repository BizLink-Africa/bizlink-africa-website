import 'server-only';
import { z } from 'zod';
import { getSelcomIntegrationStatus } from './status';

// Zod-validated view of every Selcom-related env var. Deliberately
// separate from config.ts (which stays the fail-fast, throws-on-first-use
// source of truth signing requests actually read from) — this module's
// job is (a) a stricter shape check Zod is well-suited for, and (b) the
// safe, secret-free status summary the production readiness dashboard
// renders. Every field here is optional at the schema level because
// which ones are REQUIRED depends on which environment is active
// (sandbox vs production) — that conditional requirement is enforced by
// config.ts's buildConfig(), not duplicated here.
const selcomEnvSchema = z.object({
  SELCOM_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  // Deployment-level gates — every one of these is a plain 'true'/'false'
  // string comparison, never a truthy/falsy JS coercion, so "false",
  // "0", "no", or simply being unset all resolve to disabled. Disabled by
  // default is a structural property of this schema, not a runtime check.
  SELCOM_PRODUCTION_ACTIVATION_ENABLED: z.string().optional(),
  SELCOM_INTEGRATION_ENABLED: z.string().optional(),
  SELCOM_LIVE_PAYOUTS_ENABLED: z.string().optional(),

  SELCOM_SANDBOX_BASE_URL: z.string().url().optional(),
  SELCOM_PRODUCTION_BASE_URL: z.string().url().optional(),

  SELCOM_API_KEY: z.string().min(1).optional(),
  SELCOM_RSA_PRIVATE_KEY: z.string().min(1).optional(),
  SELCOM_DISBURSEMENT_ACCOUNT: z.string().min(1).optional(),
  SELCOM_CALLBACK_SECRET: z.string().min(1).optional(),
  SELCOM_CALLBACK_URL: z.string().url().optional(),

  SELCOM_PRODUCTION_API_KEY: z.string().min(1).optional(),
  SELCOM_PRODUCTION_RSA_PRIVATE_KEY: z.string().min(1).optional(),
  SELCOM_PRODUCTION_DISBURSEMENT_ACCOUNT: z.string().min(1).optional(),
  SELCOM_PRODUCTION_CALLBACK_SECRET: z.string().min(1).optional(),
  SELCOM_PRODUCTION_CALLBACK_URL: z.string().url().optional(),
});

export type SelcomRawEnv = z.infer<typeof selcomEnvSchema>;

// Fails safely: a malformed value (e.g. SELCOM_CALLBACK_URL set to
// something that isn't a URL at all) is reported as a structured Zod
// issue list rather than crashing with a raw exception, and never echoes
// the offending value back — only the field name and Zod's own generic
// message survive into the returned issues.
export function parseSelcomRawEnv(): { success: true; data: SelcomRawEnv } | { success: false; issues: string[] } {
  const result = selcomEnvSchema.safeParse(process.env);
  if (!result.success) {
    return { success: false, issues: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  }
  return { success: true, data: result.data };
}

function isFlagTrue(name: keyof SelcomRawEnv): boolean {
  const raw = process.env[name];
  return (raw ?? '').trim().toLowerCase() === 'true';
}

// Deployment-level integration switch — independent of, and in addition
// to, the DB-backed selcom_integration_settings.integration_enabled kill
// switch (Administration -> Integrations -> Disbursement API). Both must
// be true for any Selcom call to be attempted: this one can never be
// flipped from the admin UI, only by a deployment env-var change, so it
// survives even a compromised admin session.
export function isSelcomIntegrationEnabledByEnv(): boolean {
  return isFlagTrue('SELCOM_INTEGRATION_ENABLED');
}

// The single hardest gate in this codebase. Checked exactly once, at the
// top of initiateDisbursement() (src/lib/selcom/transaction-process.ts) —
// the only function that ever calls POST /v1/transaction/process. Must
// never be true in this repository as delivered; enabling it is a
// deliberate, separate, human deployment action taken only after the full
// Production Readiness checklist and Finance + Compliance approval are
// recorded.
export function isSelcomLivePayoutsEnabledByEnv(): boolean {
  return isFlagTrue('SELCOM_LIVE_PAYOUTS_ENABLED');
}

export interface SafeSelcomEnvStatus {
  environment: 'sandbox' | 'production';
  configured: boolean;
  maskedCredentialIdentifier: string | null;
  callbackConfigured: boolean;
  integrationEnabled: boolean;
  livePayoutsEnabled: boolean;
}

// The exact, minimal safe status shape — nothing beyond these six fields,
// ever. Built on top of status.ts's richer (but still fully masked/
// boolean) getSelcomIntegrationStatus() rather than re-deriving credential
// masking logic a second time.
export function getSafeSelcomEnvStatus(): SafeSelcomEnvStatus {
  const status = getSelcomIntegrationStatus();
  const environment = status.environmentRaw === 'production' ? 'production' : 'sandbox';
  const isProd = environment === 'production';

  return {
    environment,
    configured: isProd ? status.productionCredentialStatus === 'configured' : status.credentialStatus === 'configured',
    maskedCredentialIdentifier: isProd ? status.maskedProductionApiKey : status.maskedApiKey,
    callbackConfigured: isProd ? status.productionCallbackConfigured : status.callbackConfigured,
    integrationEnabled: isSelcomIntegrationEnabledByEnv(),
    livePayoutsEnabled: isSelcomLivePayoutsEnabledByEnv(),
  };
}
