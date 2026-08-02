import { describe, expect, it } from 'vitest';
import { redactForLog } from './client';

describe('redactForLog — secret values must never appear in logs', () => {
  const secretApiKey = 'SK_LIVE_ABCDEF1234567890SECRET';
  const secretDigest = 'ZmFrZS1kaWdlc3Qtc2lnbmF0dXJlLWJ5dGVzLXRoYXQtbG9vay1yZWFsLWVub3VnaA==';
  const secretAccountNumber = '255711410410';

  it('masks header-shaped fields (api-key, digest) so the raw value never appears in the serialized output', () => {
    const payload = {
      correlationId: 'corr-1',
      headers: {
        'api-key': secretApiKey,
        digest: secretDigest,
        timestamp: '2026-05-27T06:01:03.273Z',
        'signed-fields': 'transId,amount',
        'content-type': 'application/json',
        accept: 'application/json',
      },
    };

    const redacted = redactForLog(payload);
    const serialized = JSON.stringify(redacted);

    expect(serialized).not.toContain(secretApiKey);
    expect(serialized).not.toContain(secretDigest);
    // Non-sensitive fields must survive untouched — redaction should not be
    // so aggressive it destroys debuggability.
    expect(serialized).toContain('transId,amount');
    expect(serialized).toContain('2026-05-27T06:01:03.273Z');
  });

  it('masks account/wallet-number-shaped fields nested inside request field payloads', () => {
    const payload = {
      fields: {
        recipientAccount: secretAccountNumber,
        senderAccount: secretAccountNumber,
        account_number: secretAccountNumber,
        msisdn: secretAccountNumber,
        transId: 'TXN-001',
        recipientFiCode: 'CRDB',
        amount: 100,
      },
    };

    const redacted = redactForLog(payload);
    const serialized = JSON.stringify(redacted);

    expect(serialized).not.toContain(secretAccountNumber);
    // recipientFiCode is a public institution code, not a secret — must
    // survive so logs stay useful for support/debugging.
    expect(serialized).toContain('CRDB');
    expect(serialized).toContain('TXN-001');
  });

  it('redacts recursively through nested arrays and objects (e.g. a full request/response log entry)', () => {
    const payload = {
      correlationId: 'corr-2',
      attempts: [
        { headers: { 'api-key': secretApiKey } },
        { headers: { 'api-key': secretApiKey, digest: secretDigest } },
      ],
    };

    const serialized = JSON.stringify(redactForLog(payload));
    expect(serialized).not.toContain(secretApiKey);
    expect(serialized).not.toContain(secretDigest);
  });

  it('shows only a masked tail (never the full value) for a matched sensitive field', () => {
    const redacted = redactForLog({ 'api-key': secretApiKey }) as Record<string, string>;
    expect(redacted['api-key']).not.toBe(secretApiKey);
    expect(redacted['api-key']).toContain(secretApiKey.slice(-2));
    expect(redacted['api-key'].length).toBeLessThan(secretApiKey.length + 4);
  });

  it('leaves non-object primitives (the common console.log(message, meta) case) unchanged', () => {
    expect(redactForLog('a plain string')).toBe('a plain string');
    expect(redactForLog(42)).toBe(42);
    expect(redactForLog(null)).toBe(null);
  });
});
