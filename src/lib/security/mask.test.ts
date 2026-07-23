import { describe, expect, it } from 'vitest';
import { maskSecrets, maskCredential } from './mask';

describe('maskSecrets', () => {
  it('masks api_key query params in a URL', () => {
    const input = 'https://api.partner.co.tz/v1/charge?api_key=sk_live_ABCDEFGH1234567890';
    const result = maskSecrets(input);
    expect(result).not.toContain('sk_live_ABCDEFGH1234567890');
    expect(result).toContain('api_key=sk');
  });

  it('masks a bearer token', () => {
    const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig';
    const result = maskSecrets(input);
    expect(result).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig');
  });

  it('masks long opaque tokens even without a recognizable key= prefix', () => {
    const input = 'webhook signature mismatch: whsec_abcdefghijklmnopqrstuvwxyz0123456789';
    const result = maskSecrets(input);
    expect(result).not.toContain('whsec_abcdefghijklmnopqrstuvwxyz0123456789');
  });

  it('leaves ordinary text untouched', () => {
    const input = 'GET /api/v1/clients/123 returned 200 in 45ms';
    expect(maskSecrets(input)).toBe(input);
  });

  it('handles null/undefined/empty safely', () => {
    expect(maskSecrets(null)).toBe('');
    expect(maskSecrets(undefined)).toBe('');
    expect(maskSecrets('')).toBe('');
  });
});

describe('maskCredential', () => {
  it('shows only the last 4 characters', () => {
    expect(maskCredential('sk_live_ABCDEFGH1234567890')).toBe('****7890');
  });

  it('fully masks very short values', () => {
    expect(maskCredential('abc')).toBe('****');
  });

  it('handles null/undefined', () => {
    expect(maskCredential(null)).toBe('—');
    expect(maskCredential(undefined)).toBe('—');
  });
});
