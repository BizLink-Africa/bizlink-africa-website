import { describe, expect, it } from 'vitest';
import { SandboxPayoutAdapter } from './payout-adapter';

describe('SandboxPayoutAdapter — never calls a real payout API', () => {
  const adapter = new SandboxPayoutAdapter();

  it('is explicitly labeled sandbox, never live', () => {
    expect(adapter.mode).toBe('sandbox');
    expect(adapter.name).toBe('Sandbox');
  });

  it('succeeds with a payout reference when a beneficiary is on file', async () => {
    const result = await adapter.payOut({
      batchId: 'batch-12345678',
      lineId: 'line-abcdefgh',
      merchantId: 'merchant-1',
      beneficiaryId: 'beneficiary-1',
      amount: '97000.00',
      currency: 'TZS',
    });
    expect(result.status).toBe('paid');
    expect(result.payoutReference).toContain('SANDBOX-PAYOUT-');
    expect(result.failureReason).toBeNull();
  });

  it('fails with a clear reason when there is no verified beneficiary on file', async () => {
    const result = await adapter.payOut({
      batchId: 'batch-1',
      lineId: 'line-1',
      merchantId: 'merchant-1',
      beneficiaryId: null,
      amount: '1000.00',
      currency: 'TZS',
    });
    expect(result.status).toBe('failed');
    expect(result.payoutReference).toBeNull();
    expect(result.failureReason).toMatch(/beneficiary/i);
  });

  it('always returns the lineId it was given, unchanged', async () => {
    const result = await adapter.payOut({
      batchId: 'batch-1',
      lineId: 'line-xyz',
      merchantId: 'merchant-1',
      beneficiaryId: 'beneficiary-1',
      amount: '1.00',
      currency: 'TZS',
    });
    expect(result.lineId).toBe('line-xyz');
  });
});
