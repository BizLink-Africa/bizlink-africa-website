// @vitest-environment node
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  parseSelcomRawEnv,
  isSelcomIntegrationEnabledByEnv,
  isSelcomLivePayoutsEnabledByEnv,
  getSafeSelcomEnvStatus,
} from './env';

const ALL_KEYS = [
  'SELCOM_ENV',
  'SELCOM_PRODUCTION_ACTIVATION_ENABLED',
  'SELCOM_INTEGRATION_ENABLED',
  'SELCOM_LIVE_PAYOUTS_ENABLED',
  'SELCOM_SANDBOX_BASE_URL',
  'SELCOM_PRODUCTION_BASE_URL',
  'SELCOM_API_KEY',
  'SELCOM_RSA_PRIVATE_KEY',
  'SELCOM_DISBURSEMENT_ACCOUNT',
  'SELCOM_CALLBACK_SECRET',
  'SELCOM_CALLBACK_URL',
  'SELCOM_PRODUCTION_API_KEY',
  'SELCOM_PRODUCTION_RSA_PRIVATE_KEY',
  'SELCOM_PRODUCTION_DISBURSEMENT_ACCOUNT',
  'SELCOM_PRODUCTION_CALLBACK_SECRET',
  'SELCOM_PRODUCTION_CALLBACK_URL',
];

function clearAll() {
  for (const key of ALL_KEYS) delete process.env[key];
}

beforeEach(() => clearAll());
afterEach(() => clearAll());

describe('parseSelcomRawEnv — Zod-validated shape check', () => {
  it('succeeds with nothing set at all (every field optional, SELCOM_ENV defaults to sandbox)', () => {
    const result = parseSelcomRawEnv();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.SELCOM_ENV).toBe('sandbox');
  });

  it('rejects a malformed SELCOM_CALLBACK_URL without ever echoing the value back in the issue text', () => {
    process.env.SELCOM_CALLBACK_URL = 'not-a-url';
    const result = parseSelcomRawEnv();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.some((i) => i.includes('SELCOM_CALLBACK_URL'))).toBe(true);
      expect(result.issues.join(' ')).not.toContain('not-a-url');
    }
  });

  it('rejects a SELCOM_ENV value outside the documented sandbox/production enum', () => {
    process.env.SELCOM_ENV = 'staging';
    const result = parseSelcomRawEnv();
    expect(result.success).toBe(false);
  });

  it('accepts a fully populated production credential set', () => {
    process.env.SELCOM_ENV = 'production';
    process.env.SELCOM_PRODUCTION_BASE_URL = 'https://api.selcom.business/v1';
    process.env.SELCOM_PRODUCTION_API_KEY = 'prod-key';
    process.env.SELCOM_PRODUCTION_RSA_PRIVATE_KEY = 'prod-pem';
    process.env.SELCOM_PRODUCTION_DISBURSEMENT_ACCOUNT = '1234567890';
    process.env.SELCOM_PRODUCTION_CALLBACK_SECRET = 'prod-secret';
    process.env.SELCOM_PRODUCTION_CALLBACK_URL = 'https://admin.example.com/api/integrations/selcom/callback/prod-secret';
    const result = parseSelcomRawEnv();
    expect(result.success).toBe(true);
  });
});

describe('isSelcomIntegrationEnabledByEnv / isSelcomLivePayoutsEnabledByEnv — disabled by default', () => {
  it('both are false when unset', () => {
    expect(isSelcomIntegrationEnabledByEnv()).toBe(false);
    expect(isSelcomLivePayoutsEnabledByEnv()).toBe(false);
  });

  it('both require the exact string "true" (case/whitespace-insensitive), never JS truthy coercion', () => {
    process.env.SELCOM_INTEGRATION_ENABLED = '1';
    process.env.SELCOM_LIVE_PAYOUTS_ENABLED = 'yes';
    expect(isSelcomIntegrationEnabledByEnv()).toBe(false);
    expect(isSelcomLivePayoutsEnabledByEnv()).toBe(false);

    process.env.SELCOM_INTEGRATION_ENABLED = ' True ';
    process.env.SELCOM_LIVE_PAYOUTS_ENABLED = 'TRUE';
    expect(isSelcomIntegrationEnabledByEnv()).toBe(true);
    expect(isSelcomLivePayoutsEnabledByEnv()).toBe(true);
  });

  it('are independent of each other', () => {
    process.env.SELCOM_INTEGRATION_ENABLED = 'true';
    expect(isSelcomIntegrationEnabledByEnv()).toBe(true);
    expect(isSelcomLivePayoutsEnabledByEnv()).toBe(false);
  });
});

describe('getSafeSelcomEnvStatus — exactly six fields, never a raw secret', () => {
  it('returns only the six documented fields', () => {
    const status = getSafeSelcomEnvStatus();
    expect(Object.keys(status).sort()).toEqual(
      ['callbackConfigured', 'configured', 'environment', 'integrationEnabled', 'livePayoutsEnabled', 'maskedCredentialIdentifier'].sort()
    );
  });

  it('reflects sandbox by default with not-configured/disabled when nothing is set', () => {
    const status = getSafeSelcomEnvStatus();
    expect(status.environment).toBe('sandbox');
    expect(status.configured).toBe(false);
    expect(status.integrationEnabled).toBe(false);
    expect(status.livePayoutsEnabled).toBe(false);
    expect(status.maskedCredentialIdentifier).toBeNull();
  });

  it('never returns a value long enough or shaped enough to be the real credential', () => {
    process.env.SELCOM_API_KEY = 'super-secret-sandbox-api-key-value-12345';
    const status = getSafeSelcomEnvStatus();
    expect(status.maskedCredentialIdentifier).not.toBe(process.env.SELCOM_API_KEY);
    expect(status.maskedCredentialIdentifier ?? '').not.toContain('super-secret-sandbox-api-key-value');
  });

  it('switches to the production credential/callback fields when SELCOM_ENV=production', () => {
    process.env.SELCOM_ENV = 'production';
    process.env.SELCOM_PRODUCTION_ACTIVATION_ENABLED = 'true';
    const status = getSafeSelcomEnvStatus();
    expect(status.environment).toBe('production');
  });
});
