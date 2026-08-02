// @vitest-environment node
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { getSelcomConfig, resolveSelcomEnvironment, resetSelcomConfigCacheForTests } from './config';
import { SelcomConfigError } from './errors';

const SANDBOX_KEYS = ['SELCOM_ENV', 'SELCOM_SANDBOX_BASE_URL', 'SELCOM_API_KEY', 'SELCOM_RSA_PRIVATE_KEY', 'SELCOM_DISBURSEMENT_ACCOUNT', 'SELCOM_CALLBACK_SECRET', 'SELCOM_CALLBACK_URL'];
const PRODUCTION_KEYS = [
  'SELCOM_PRODUCTION_ACTIVATION_ENABLED',
  'SELCOM_PRODUCTION_BASE_URL',
  'SELCOM_PRODUCTION_API_KEY',
  'SELCOM_PRODUCTION_RSA_PRIVATE_KEY',
  'SELCOM_PRODUCTION_DISBURSEMENT_ACCOUNT',
  'SELCOM_PRODUCTION_CALLBACK_SECRET',
  'SELCOM_PRODUCTION_CALLBACK_URL',
];
const ALL_KEYS = [...SANDBOX_KEYS, ...PRODUCTION_KEYS];

// A real, freshly-generated 2048-bit RSA private key so createPrivateKey()
// actually parses successfully — generated purely for this test file
// (via node's own crypto.generateKeyPairSync, not copied from anywhere),
// never used anywhere real.
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDpEHO0AyXZoQcH
l2RUzUaVLT4qlNqFfyOYZm7iSJ3cOfIktZpUSyQh6zL0GJ96CIc+Bq5tkEVgMGys
rwTSyJVwj+o0LXhxfdQ3exoLFX1SxoFbvl8ikiqholBx8WKGbRHy47kuGh/yVJSC
QTY4YPAhvggxck0a9lR/fnEeWiv1d2b7+SsBXAO52col6UOEZWVbIpvKfatG+s4R
WkkIvIvFh62/z2qvlPt4vHfHKJilXViTvGsMEySTdyJe0+B2vX6RbNtwWSL6oY4t
BtUdTjdTQ+nIcxc0pdcJyWC8tHHk0yIdGbajvsIBaG0X5v4Djkf08suQoITr55W9
BCQFNK8HAgMBAAECggEAECHomfzfZKSpNrToZ8scKAmzreetbWQswJXTXKwOHhP2
V0tcXWbxUolUEGIyV8e5vmj6Yr2DyXHqQKHBjoP+SoZYfdG2VPssWPkw0+eVS/xP
MMLve6/s1FD58VX2FFWXn0QOdpet8myfj8yXxjTfkLzCSga305zAoi3MaRkKX4YJ
SoIvn7t04zS666RwOmKbhF/xRe8OKKYPhuQQH4X90QC+pWa4aml3TZ944fOv6Z9e
AQkSARqKD/zHl0XhYQcBdRsgapjzpSJDjNxu7i2wS7ICLQTtgzVtED4f1p/B595Z
B0+rVkjhwnba420OiGcV7JWUscEMC3+s3nT4r0+AsQKBgQD7vMK1UKczT1VH5aQE
tKwmnyfCPk0BsmF5lJY7EB1L5YgnaQ6/XsM9iECFor/6WnjaUaHZNEGrQphIeE3/
tp5keMaai5oQdGrufNaLL1KAAk/eseUAdQ9gvT01B1kUPmUlNfi/OCmyFhywWjmv
VpAm9ylJDQHYXAIQonSGOkU+YwKBgQDtAr8ndPwnpVG2ZWqn9Hhrx5cepoOiqtIo
qikfzfmrPl3auyAM4T9wp+QRqfxje9lLpkRiRaCsTRNswdliORF8U9kR0mhbHTWG
NSTyRE//1TDuC+IqbJ/QhO98ucgMHXcUTsRbsSPJ3fFv0ag7EVnema5wvdmfmNQj
/MYQzwKsDQKBgDGP9WnLSlAA05KHNOa0R5yHA0XsDC9EVoqgZX+VaZ8yvr67oWqu
FpR7yfBFnbSFsXuSTOI9tpwoTWEfRoQNCVxQpxFwYNHSiecQbxESLRUE34LB1Ytk
gLWULIPPQYuJyVItMR88yIDGd7mE2gyaZ2E0kk1OoUlevA1YXsa6nD1vAoGACr+B
I6zucm3Q0tCukYdInrqiY8VxWsMcXLO6wbJ5jAZ8AxtRTMQ6OEWk1hg7Vdeb9w5H
M52st6OXKetwjD/CRz0WLvS3vsoIT1nBnyrx5cwpN+JaE0pxxOcCZUmXhNUhPU6F
IRNbaCAkfsmnM2aKCMo3Wu2BHPe1RxyDbue0W1ECgYAlM6vGH6sV408/uD/Wn+Hy
jLM3SOBIrqMhnldHWfetRL3JDFHb/JwFmFn4Bc9yxzAxTf+UjDT4gPGcnbXRUIbx
fv5Vk+wDuFHvVa68+k1wstq5cuOn8U12GG9aG2JuDtYJgG8T63orDJ3TiVxlkmRU
dXUsdpY9wPfTtRwZb4YRvQ==
-----END PRIVATE KEY-----`;

function clearAll() {
  for (const key of ALL_KEYS) delete process.env[key];
}

function setSandbox(overrides: Record<string, string> = {}) {
  process.env.SELCOM_ENV = 'sandbox';
  process.env.SELCOM_SANDBOX_BASE_URL = 'https://sandbox.selcom.business';
  process.env.SELCOM_API_KEY = 'sandbox-api-key';
  process.env.SELCOM_RSA_PRIVATE_KEY = TEST_PRIVATE_KEY;
  process.env.SELCOM_DISBURSEMENT_ACCOUNT = '7545037522515';
  process.env.SELCOM_CALLBACK_SECRET = 'sandbox-callback-secret';
  process.env.SELCOM_CALLBACK_URL = 'https://admin.example.com/api/integrations/selcom/callback/sandbox-callback-secret';
  Object.assign(process.env, overrides);
}

function setProduction(overrides: Record<string, string> = {}) {
  process.env.SELCOM_ENV = 'production';
  process.env.SELCOM_PRODUCTION_ACTIVATION_ENABLED = 'true';
  process.env.SELCOM_PRODUCTION_BASE_URL = 'https://api.selcom.business/v1';
  process.env.SELCOM_PRODUCTION_API_KEY = 'production-api-key';
  process.env.SELCOM_PRODUCTION_RSA_PRIVATE_KEY = TEST_PRIVATE_KEY;
  process.env.SELCOM_PRODUCTION_DISBURSEMENT_ACCOUNT = '9999999999999';
  process.env.SELCOM_PRODUCTION_CALLBACK_SECRET = 'production-callback-secret';
  process.env.SELCOM_PRODUCTION_CALLBACK_URL = 'https://admin.example.com/api/integrations/selcom/callback/production-callback-secret';
  Object.assign(process.env, overrides);
}

beforeEach(() => {
  clearAll();
  resetSelcomConfigCacheForTests();
});

afterEach(() => {
  clearAll();
  resetSelcomConfigCacheForTests();
});

describe('resolveSelcomEnvironment — the deployment-level production gate', () => {
  it('defaults to sandbox when SELCOM_ENV is unset', () => {
    expect(resolveSelcomEnvironment()).toBe('sandbox');
  });

  it('rejects a garbage SELCOM_ENV value', () => {
    process.env.SELCOM_ENV = 'staging';
    expect(() => resolveSelcomEnvironment()).toThrow(SelcomConfigError);
  });

  it('rejects SELCOM_ENV=production when SELCOM_PRODUCTION_ACTIVATION_ENABLED is unset — "production activation must be disabled by default"', () => {
    process.env.SELCOM_ENV = 'production';
    expect(() => resolveSelcomEnvironment()).toThrow(/SELCOM_PRODUCTION_ACTIVATION_ENABLED/);
  });

  it('rejects SELCOM_ENV=production when SELCOM_PRODUCTION_ACTIVATION_ENABLED is anything other than "true"', () => {
    process.env.SELCOM_ENV = 'production';
    for (const value of ['false', '1', 'yes', '']) {
      process.env.SELCOM_PRODUCTION_ACTIVATION_ENABLED = value;
      expect(() => resolveSelcomEnvironment(), `value "${value}" should not enable production`).toThrow();
    }
  });

  it('allows SELCOM_ENV=production only when SELCOM_PRODUCTION_ACTIVATION_ENABLED=true exactly', () => {
    process.env.SELCOM_ENV = 'production';
    process.env.SELCOM_PRODUCTION_ACTIVATION_ENABLED = 'true';
    expect(resolveSelcomEnvironment()).toBe('production');
  });

  it('is case-insensitive and trims whitespace for both flags', () => {
    process.env.SELCOM_ENV = '  Production  ';
    process.env.SELCOM_PRODUCTION_ACTIVATION_ENABLED = ' TRUE ';
    expect(resolveSelcomEnvironment()).toBe('production');
  });
});

describe('getSelcomConfig — sandbox and production credentials are fully separate sets', () => {
  it('builds a sandbox config from the unprefixed credential env vars', () => {
    setSandbox();
    const config = getSelcomConfig();
    expect(config.env).toBe('sandbox');
    expect(config.apiKey).toBe('sandbox-api-key');
    expect(config.disbursementAccount).toBe('7545037522515');
    expect(config.baseUrl).toBe('https://sandbox.selcom.business');
  });

  it('builds a production config from the SELCOM_PRODUCTION_* env vars, never falling back to sandbox values', () => {
    setProduction();
    const config = getSelcomConfig();
    expect(config.env).toBe('production');
    expect(config.apiKey).toBe('production-api-key');
    expect(config.apiKey).not.toBe('sandbox-api-key');
    expect(config.disbursementAccount).toBe('9999999999999');
    expect(config.baseUrl).toBe('https://api.selcom.business/v1');
  });

  it('refuses to build a production config missing any one production-specific var, even with sandbox fully configured', () => {
    setSandbox();
    setProduction();
    delete process.env.SELCOM_PRODUCTION_API_KEY;
    expect(() => getSelcomConfig()).toThrow(/SELCOM_PRODUCTION_API_KEY/);
  });

  it('never uses a sandbox credential as a production fallback when production vars are simply absent', () => {
    process.env.SELCOM_ENV = 'production';
    process.env.SELCOM_PRODUCTION_ACTIVATION_ENABLED = 'true';
    process.env.SELCOM_PRODUCTION_BASE_URL = 'https://api.selcom.business/v1';
    // Sandbox fully configured, production credentials NOT set at all.
    process.env.SELCOM_API_KEY = 'sandbox-api-key';
    process.env.SELCOM_RSA_PRIVATE_KEY = TEST_PRIVATE_KEY;
    process.env.SELCOM_DISBURSEMENT_ACCOUNT = '7545037522515';
    expect(() => getSelcomConfig()).toThrow(SelcomConfigError);
  });

  it('rejects a malformed production PEM private key with a production-specific error message', () => {
    setProduction({ SELCOM_PRODUCTION_RSA_PRIVATE_KEY: 'not-a-real-key' });
    expect(() => getSelcomConfig()).toThrow(/SELCOM_PRODUCTION_RSA_PRIVATE_KEY is not a valid PEM/);
  });

  it('caches the resolved config across calls until reset', () => {
    setSandbox();
    const first = getSelcomConfig();
    process.env.SELCOM_API_KEY = 'changed-after-first-call';
    const second = getSelcomConfig();
    expect(second).toBe(first);
    expect(second.apiKey).toBe('sandbox-api-key');
  });
});
