import 'server-only';
import { createPrivateKey } from 'node:crypto';
import { maskCredential } from '@/lib/security/mask';

// Non-throwing status introspection for the Administration -> Integrations
// -> Disbursement API dashboard. Deliberately separate from config.ts:
// config.ts is fail-fast (throws the moment anything is missing/invalid,
// which is correct for code about to make a real signed request) — a
// status page needs the opposite behaviour, always rendering a graceful
// "here's what's wrong" view instead of a stack trace. The PEM-parse
// duplication with config.ts is intentional for that reason.
//
// Nothing in this file ever returns a raw secret. maskedApiKey and
// maskedDisbursementAccount (and their production counterparts) are the
// ONLY representations of those values this module produces, using the
// same maskCredential() helper already used everywhere else in this app
// for the same purpose.

export type SelcomCredentialStatus = 'not_configured' | 'incomplete' | 'invalid_key' | 'configured';

export interface SelcomIntegrationStatusSnapshot {
  environmentRaw: string;
  // True for sandbox unconditionally; true for production only when
  // SELCOM_PRODUCTION_ACTIVATION_ENABLED=true is ALSO set (see
  // config.ts's resolveSelcomEnvironment() — the same two-flag gate,
  // checked here without throwing).
  environmentValid: boolean;
  // The deployment-level production gate itself, surfaced separately from
  // environmentValid so the Production Readiness page can show "the
  // deployment allows production" as a distinct fact from "SELCOM_ENV is
  // currently set to production" — a sandbox deployment can still have
  // this flag off (the common/default case) or, unusually, on (allowed
  // but not currently active).
  productionActivationEnabledFlag: boolean;
  credentialStatus: SelcomCredentialStatus;
  missingEnvVars: string[];
  maskedApiKey: string | null;
  maskedDisbursementAccount: string | null;
  callbackUrlConfigured: boolean;
  callbackSecretConfigured: boolean;
  callbackUrlIsHttps: boolean;
  callbackUrlHost: string | null;
  callbackConfigured: boolean;
  // Production credential set — fully separate env vars from the above
  // (see config.ts's REQUIRED_PRODUCTION_SELCOM_ENV_VARS). Populated
  // regardless of environmentRaw, so "production credentials generated"
  // can be checked even while actively running in sandbox.
  productionCredentialStatus: SelcomCredentialStatus;
  productionMissingEnvVars: string[];
  maskedProductionApiKey: string | null;
  maskedProductionDisbursementAccount: string | null;
  productionCallbackUrlConfigured: boolean;
  productionCallbackSecretConfigured: boolean;
  productionCallbackUrlIsHttps: boolean;
  productionCallbackUrlHost: string | null;
  productionCallbackConfigured: boolean;
}

const REQUIRED_FOR_CREDENTIAL_STATUS = ['SELCOM_API_KEY', 'SELCOM_RSA_PRIVATE_KEY', 'SELCOM_DISBURSEMENT_ACCOUNT'] as const;
const REQUIRED_FOR_PRODUCTION_CREDENTIAL_STATUS = [
  'SELCOM_PRODUCTION_API_KEY',
  'SELCOM_PRODUCTION_RSA_PRIVATE_KEY',
  'SELCOM_PRODUCTION_DISBURSEMENT_ACCOUNT',
] as const;

function normalizePrivateKeyForParsing(raw: string): string {
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

function computeCredentialStatus(required: readonly string[], privateKeyVarName: string): { status: SelcomCredentialStatus; missing: string[] } {
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length === required.length) {
    return { status: 'not_configured', missing: [...missing] };
  }
  if (missing.length > 0) {
    return { status: 'incomplete', missing: [...missing] };
  }
  const pem = normalizePrivateKeyForParsing(process.env[privateKeyVarName]!);
  try {
    createPrivateKey(pem);
    return { status: 'configured', missing: [] };
  } catch {
    return { status: 'invalid_key', missing: [] };
  }
}

function computeCallbackStatus(urlVar: string, secretVar: string) {
  const callbackUrlConfigured = Boolean(process.env[urlVar]);
  const callbackSecretConfigured = Boolean(process.env[secretVar]);

  let callbackUrlIsHttps = false;
  let callbackUrlHost: string | null = null;
  if (process.env[urlVar]) {
    try {
      const parsed = new URL(process.env[urlVar]!);
      callbackUrlHost = parsed.host;
      callbackUrlIsHttps = parsed.protocol === 'https:';
    } catch {
      // Malformed URL — callbackUrlHost stays null, callbackConfigured
      // below correctly ends up false.
    }
  }

  return {
    callbackUrlConfigured,
    callbackSecretConfigured,
    callbackUrlIsHttps,
    callbackUrlHost,
    callbackConfigured: callbackUrlConfigured && callbackSecretConfigured && callbackUrlIsHttps,
  };
}

export function isProductionActivationEnabledFlag(): boolean {
  return (process.env.SELCOM_PRODUCTION_ACTIVATION_ENABLED ?? '').trim().toLowerCase() === 'true';
}

export function getSelcomIntegrationStatus(): SelcomIntegrationStatusSnapshot {
  const environmentRaw = (process.env.SELCOM_ENV ?? 'sandbox').trim().toLowerCase();
  const productionActivationEnabledFlag = isProductionActivationEnabledFlag();
  const environmentValid = environmentRaw === 'sandbox' || (environmentRaw === 'production' && productionActivationEnabledFlag);

  const { status: credentialStatus, missing: missingEnvVars } = computeCredentialStatus(REQUIRED_FOR_CREDENTIAL_STATUS, 'SELCOM_RSA_PRIVATE_KEY');
  const { status: productionCredentialStatus, missing: productionMissingEnvVars } = computeCredentialStatus(
    REQUIRED_FOR_PRODUCTION_CREDENTIAL_STATUS,
    'SELCOM_PRODUCTION_RSA_PRIVATE_KEY'
  );

  const maskedApiKey = process.env.SELCOM_API_KEY ? maskCredential(process.env.SELCOM_API_KEY) : null;
  const maskedDisbursementAccount = process.env.SELCOM_DISBURSEMENT_ACCOUNT ? maskCredential(process.env.SELCOM_DISBURSEMENT_ACCOUNT) : null;
  const maskedProductionApiKey = process.env.SELCOM_PRODUCTION_API_KEY ? maskCredential(process.env.SELCOM_PRODUCTION_API_KEY) : null;
  const maskedProductionDisbursementAccount = process.env.SELCOM_PRODUCTION_DISBURSEMENT_ACCOUNT
    ? maskCredential(process.env.SELCOM_PRODUCTION_DISBURSEMENT_ACCOUNT)
    : null;

  const callback = computeCallbackStatus('SELCOM_CALLBACK_URL', 'SELCOM_CALLBACK_SECRET');
  const productionCallback = computeCallbackStatus('SELCOM_PRODUCTION_CALLBACK_URL', 'SELCOM_PRODUCTION_CALLBACK_SECRET');

  return {
    environmentRaw,
    environmentValid,
    productionActivationEnabledFlag,
    credentialStatus,
    missingEnvVars,
    maskedApiKey,
    maskedDisbursementAccount,
    callbackUrlConfigured: callback.callbackUrlConfigured,
    callbackSecretConfigured: callback.callbackSecretConfigured,
    callbackUrlIsHttps: callback.callbackUrlIsHttps,
    callbackUrlHost: callback.callbackUrlHost,
    callbackConfigured: callback.callbackConfigured,
    productionCredentialStatus,
    productionMissingEnvVars,
    maskedProductionApiKey,
    maskedProductionDisbursementAccount,
    productionCallbackUrlConfigured: productionCallback.callbackUrlConfigured,
    productionCallbackSecretConfigured: productionCallback.callbackSecretConfigured,
    productionCallbackUrlIsHttps: productionCallback.callbackUrlIsHttps,
    productionCallbackUrlHost: productionCallback.callbackUrlHost,
    productionCallbackConfigured: productionCallback.callbackConfigured,
  };
}
