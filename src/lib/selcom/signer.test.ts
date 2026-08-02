import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, verify as cryptoVerify } from 'node:crypto';
import {
  buildSignedFieldsHeader,
  buildSignedRequestHeaders,
  buildSigningString,
  generateTimestamp,
  signRequest,
} from './signer';
import { SelcomSigningError } from './errors';
import type { OrderedFields } from './types';

// Test-only keypair — never a real Selcom credential, generated fresh per
// test run and used purely to verify the signing math is correct.
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

describe('generateTimestamp', () => {
  it('produces UTC ISO-8601 with milliseconds, matching the docs example format', () => {
    const fixed = new Date('2026-05-27T06:01:03.273Z');
    expect(generateTimestamp(fixed)).toBe('2026-05-27T06:01:03.273Z');
  });

  it('matches the exact shape YYYY-MM-DDTHH:mm:ss.sssZ', () => {
    expect(generateTimestamp()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

describe('buildSigningString', () => {
  const fields: OrderedFields = [
    ['transId', '1234567899'],
    ['recipientFiCode', 'SELCOM'],
    ['recipientAccount', '255711410410'],
    ['recipientName', 'John Doe'],
    ['amount', 100],
    ['purpose', 'FT'],
  ];

  it('always puts timestamp first, joined with &, in key=value form — matching the documented formula', () => {
    const result = buildSigningString('2026-05-27T06:01:03.273Z', fields);
    expect(result).toBe(
      'timestamp=2026-05-27T06:01:03.273Z&transId=1234567899&recipientFiCode=SELCOM&recipientAccount=255711410410&recipientName=John Doe&amount=100&purpose=FT'
    );
  });

  it('reflects a different field order exactly — signed-field order is never independently decided', () => {
    const reordered: OrderedFields = [
      ['purpose', 'FT'],
      ['transId', '1234567899'],
    ];
    const result = buildSigningString('T', reordered);
    expect(result).toBe('timestamp=T&purpose=FT&transId=1234567899');
  });
});

describe('buildSignedFieldsHeader', () => {
  it('lists field names only, comma-separated, in the same order as the signing string', () => {
    const fields: OrderedFields = [
      ['transId', '1'],
      ['recipientFiCode', 'SELCOM'],
      ['amount', 100],
    ];
    expect(buildSignedFieldsHeader(fields)).toBe('transId,recipientFiCode,amount');
  });

  it('never includes "timestamp" itself', () => {
    const fields: OrderedFields = [['transId', '1']];
    expect(buildSignedFieldsHeader(fields)).not.toContain('timestamp');
  });
});

describe('signRequest', () => {
  it('produces a Base64 RSA-SHA256 signature that verifies against the matching public key', () => {
    const signingString = 'timestamp=2026-05-27T06:01:03.273Z&transId=1&amount=100';
    const digest = signRequest(signingString, privateKey);

    const isValid = cryptoVerify('RSA-SHA256', Buffer.from(signingString, 'utf8'), publicKey, Buffer.from(digest, 'base64'));
    expect(isValid).toBe(true);
  });

  it('produces a signature that fails verification against a tampered signing string', () => {
    const signingString = 'timestamp=2026-05-27T06:01:03.273Z&transId=1&amount=100';
    const digest = signRequest(signingString, privateKey);

    const tampered = signingString.replace('amount=100', 'amount=999999');
    const isValid = cryptoVerify('RSA-SHA256', Buffer.from(tampered, 'utf8'), publicKey, Buffer.from(digest, 'base64'));
    expect(isValid).toBe(false);
  });

  it('is deterministic-safe: two signatures of the same string both verify (RSA-SHA256/PKCS1v15 is deterministic)', () => {
    const signingString = 'timestamp=T&transId=1';
    const first = signRequest(signingString, privateKey);
    const second = signRequest(signingString, privateKey);
    expect(first).toBe(second);
  });

  it('throws a typed SelcomSigningError for a malformed private key, never echoing key material', () => {
    let thrown: unknown;
    try {
      signRequest('timestamp=T&transId=1', 'not-a-valid-pem', 'corr-123');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(SelcomSigningError);
    const error = thrown as SelcomSigningError;
    expect(error.correlationId).toBe('corr-123');
    expect(error.message).not.toContain('not-a-valid-pem');
  });
});

describe('buildSignedRequestHeaders', () => {
  it('returns exactly the documented header set, with a digest that verifies against the same fields', () => {
    const fields: OrderedFields = [
      ['transId', '1234567899'],
      ['amount', 100],
    ];
    const headers = buildSignedRequestHeaders({
      apiKey: 'test-api-key-value',
      privateKeyPem: privateKey,
      fields,
      timestamp: '2026-05-27T06:01:03.273Z',
    });

    expect(headers).toMatchObject({
      'api-key': 'test-api-key-value',
      timestamp: '2026-05-27T06:01:03.273Z',
      'signed-fields': 'transId,amount',
      'content-type': 'application/json',
      accept: 'application/json',
    });

    const expectedSigningString = buildSigningString('2026-05-27T06:01:03.273Z', fields);
    const isValid = cryptoVerify(
      'RSA-SHA256',
      Buffer.from(expectedSigningString, 'utf8'),
      publicKey,
      Buffer.from(headers.digest, 'base64')
    );
    expect(isValid).toBe(true);
  });

  it('generates its own timestamp when none is supplied', () => {
    const fields: OrderedFields = [['transId', '1']];
    const headers = buildSignedRequestHeaders({ apiKey: 'k', privateKeyPem: privateKey, fields });
    expect(headers.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
