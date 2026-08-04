import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { SelcomConfigError, SelcomNetworkError } from './errors';
import type { SelcomConfig } from './types';

vi.mock('./config', () => ({
  getSelcomConfig: vi.fn(),
}));

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const SANDBOX_CONFIG: SelcomConfig = {
  env: 'sandbox',
  baseUrl: 'https://sandbox.selcom.business',
  apiKey: 'test-api-key',
  privateKeyPem: privateKey,
  disbursementAccount: '0000000000',
  callbackSecret: 'test-callback-secret',
  callbackUrl: 'https://admin.bizlinkafrica.net/api/selcom/callback',
};

const VALID_REQUEST = {
  transId: 'TXN-TEST-001',
  recipientFiCode: 'CRDB',
  recipientAccount: '255711410410',
  recipientName: 'John Doe',
  amount: '100.00',
  purpose: 'FT',
};

// Every test below sets these explicitly rather than relying on ambient
// process.env — the whole point of this suite is proving the gates react
// correctly to each flag's exact state, so nothing here should depend on
// what happens to be set in the shell running the tests.
beforeEach(() => {
  vi.stubEnv('SELCOM_INTEGRATION_ENABLED', 'true');
  vi.stubEnv('SELCOM_LIVE_PAYOUTS_ENABLED', '');
  // The BIZLINK_MANAGES_MERCHANT_SETTLEMENTS gate (see
  // 'BizLink does not manage merchant settlement' describe block below) is
  // the most fundamental of the three and is checked first — every test in
  // the OTHER describe blocks below is exercising the two gates
  // *underneath* it, so it must be explicitly satisfied here for those
  // tests to reach the code they're actually testing.
  vi.stubEnv('BIZLINK_MANAGES_MERCHANT_SETTLEMENTS', 'true');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// BizLink Africa does not manage merchant settlement — merchants settle
// directly with their approved payment partner. This is the most
// fundamental gate: checked first, ahead of the two deployment-level
// Selcom flags below, and unaffected by whether they're satisfied.
describe('initiateDisbursement — BizLink does not manage merchant settlement (checked first, ahead of the Selcom flags)', () => {
  it('refuses to run when BIZLINK_MANAGES_MERCHANT_SETTLEMENTS is unset (the required default), even with both Selcom flags satisfied, and never calls fetch', async () => {
    vi.stubEnv('BIZLINK_MANAGES_MERCHANT_SETTLEMENTS', '');
    vi.stubEnv('SELCOM_LIVE_PAYOUTS_ENABLED', 'true');
    const { getSelcomConfig } = await import('./config');
    vi.mocked(getSelcomConfig).mockReturnValue({ ...SANDBOX_CONFIG, env: 'production' });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { initiateDisbursement } = await import('./transaction-process');

    await expect(initiateDisbursement(VALID_REQUEST)).rejects.toThrow(
      'Merchant payouts are not handled by BizLink Africa. Settlement is managed directly by each merchant through the approved payment partner.'
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses to run in sandbox too — this gate applies regardless of environment', async () => {
    vi.stubEnv('BIZLINK_MANAGES_MERCHANT_SETTLEMENTS', '');
    const { getSelcomConfig } = await import('./config');
    vi.mocked(getSelcomConfig).mockReturnValue(SANDBOX_CONFIG);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { initiateDisbursement } = await import('./transaction-process');

    await expect(initiateDisbursement(VALID_REQUEST)).rejects.toThrow(/not handled by BizLink Africa/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('treats any value other than exactly "true" as not-managed — no live payout can be submitted by misconfiguration', async () => {
    for (const value of ['false', '1', 'yes', 'TRUE_ISH']) {
      vi.stubEnv('BIZLINK_MANAGES_MERCHANT_SETTLEMENTS', value);
      const { getSelcomConfig } = await import('./config');
      vi.mocked(getSelcomConfig).mockReturnValue(SANDBOX_CONFIG);
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const { initiateDisbursement } = await import('./transaction-process');

      await expect(initiateDisbursement(VALID_REQUEST)).rejects.toThrow(/not handled by BizLink Africa/);
      expect(fetchSpy).not.toHaveBeenCalled();
    }
  });
});

describe('initiateDisbursement — SELCOM_INTEGRATION_ENABLED gate (required for every environment)', () => {
  it('refuses to run when SELCOM_INTEGRATION_ENABLED is not "true", even in sandbox, and never calls fetch', async () => {
    vi.stubEnv('SELCOM_INTEGRATION_ENABLED', '');
    const { getSelcomConfig } = await import('./config');
    vi.mocked(getSelcomConfig).mockReturnValue(SANDBOX_CONFIG);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { initiateDisbursement } = await import('./transaction-process');

    await expect(initiateDisbursement(VALID_REQUEST)).rejects.toThrow(/SELCOM_INTEGRATION_ENABLED/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('treats a truthy-looking but non-"true" value (e.g. "1") as disabled — no JS truthy coercion', async () => {
    vi.stubEnv('SELCOM_INTEGRATION_ENABLED', '1');
    const { getSelcomConfig } = await import('./config');
    vi.mocked(getSelcomConfig).mockReturnValue(SANDBOX_CONFIG);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { initiateDisbursement } = await import('./transaction-process');

    await expect(initiateDisbursement(VALID_REQUEST)).rejects.toThrow(/SELCOM_INTEGRATION_ENABLED/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('initiateDisbursement — SELCOM_LIVE_PAYOUTS_ENABLED gate (production only)', () => {
  it('refuses a production disbursement when SELCOM_LIVE_PAYOUTS_ENABLED is not "true", and never calls fetch', async () => {
    const { getSelcomConfig } = await import('./config');
    vi.mocked(getSelcomConfig).mockReturnValue({ ...SANDBOX_CONFIG, env: 'production' });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { initiateDisbursement } = await import('./transaction-process');

    let thrown: unknown;
    try {
      await initiateDisbursement(VALID_REQUEST);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(SelcomConfigError);
    expect((thrown as Error).message).toMatch(/SELCOM_LIVE_PAYOUTS_ENABLED/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('never requires SELCOM_LIVE_PAYOUTS_ENABLED for sandbox — sandbox never moves real funds', async () => {
    const { getSelcomConfig } = await import('./config');
    vi.mocked(getSelcomConfig).mockReturnValue(SANDBOX_CONFIG); // env: 'sandbox', LIVE_PAYOUTS still unset
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, error_code: 0, message: 'ok', result: 'SUCCESS', resultcode: '000', data: { trans_id: VALID_REQUEST.transId, selcom_receipt: 'SBS-1', status: 'ACCEPTED', amount: 100, currency: 'TZS' } }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { initiateDisbursement } = await import('./transaction-process');

    await expect(initiateDisbursement(VALID_REQUEST)).resolves.toBeDefined();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('proceeds to call fetch for a production disbursement once BOTH gates are satisfied — proves the gate genuinely opens, not just that it stays shut', async () => {
    vi.stubEnv('SELCOM_LIVE_PAYOUTS_ENABLED', 'true');
    const { getSelcomConfig } = await import('./config');
    vi.mocked(getSelcomConfig).mockReturnValue({ ...SANDBOX_CONFIG, env: 'production', baseUrl: 'https://api.selcom.business/v1' });
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, error_code: 0, message: 'ok', result: 'SUCCESS', resultcode: '000', data: { trans_id: VALID_REQUEST.transId, selcom_receipt: 'SBS-1', status: 'ACCEPTED', amount: 100, currency: 'TZS' } }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { initiateDisbursement } = await import('./transaction-process');

    await expect(initiateDisbursement(VALID_REQUEST)).resolves.toBeDefined();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('initiateDisbursement — never automatically retried', () => {
  it('makes exactly one request attempt even when it fails, unlike the read-only lookups', async () => {
    const { getSelcomConfig } = await import('./config');
    vi.mocked(getSelcomConfig).mockReturnValue(SANDBOX_CONFIG);
    const fetchSpy = vi.fn().mockRejectedValue(new Error('simulated network failure'));
    vi.stubGlobal('fetch', fetchSpy);

    const { initiateDisbursement } = await import('./transaction-process');

    await expect(initiateDisbursement(VALID_REQUEST)).rejects.toBeInstanceOf(SelcomNetworkError);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('initiateDisbursement — input validation before any network call', () => {
  it('rejects an invalid amount without calling fetch', async () => {
    const { getSelcomConfig } = await import('./config');
    vi.mocked(getSelcomConfig).mockReturnValue(SANDBOX_CONFIG);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { initiateDisbursement } = await import('./transaction-process');

    await expect(initiateDisbursement({ ...VALID_REQUEST, amount: 'not-a-number' })).rejects.toThrow(/decimal/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
