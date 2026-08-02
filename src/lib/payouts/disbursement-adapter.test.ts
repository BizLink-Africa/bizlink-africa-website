import { describe, expect, it } from 'vitest';
import { SandboxDisbursementAdapter } from './disbursement-adapter';

describe('SandboxDisbursementAdapter — never calls a real disbursement API', () => {
  const adapter = new SandboxDisbursementAdapter();

  it('is explicitly labeled sandbox, never live', () => {
    expect(adapter.mode).toBe('sandbox');
    expect(adapter.name).toBe('Sandbox');
  });

  describe('submitPayout — idempotency', () => {
    const request = {
      payoutId: 'payout-1',
      payoutReference: 'PAY-2026-0001',
      idempotencyKey: 'PAYOUT-abc123',
      merchantId: 'merchant-1',
      beneficiaryId: 'beneficiary-1',
      destinationType: 'bank_account' as const,
      amount: '97000.00',
      currency: 'TZS',
    };

    it('succeeds with a provider reference derived from the idempotency key', async () => {
      const result = await adapter.submitPayout(request);
      expect(result.status).toBe('successful');
      expect(result.providerPayoutReference).toBe('SANDBOX-DISB-PAYOUT-abc123');
    });

    it('returns the exact same provider reference for a repeated call with the same idempotency key', async () => {
      const first = await adapter.submitPayout(request);
      const second = await adapter.submitPayout(request);
      expect(second.providerPayoutReference).toBe(first.providerPayoutReference);
    });

    it('fails with a clear code when there is no beneficiary/destination on file', async () => {
      const result = await adapter.submitPayout({ ...request, beneficiaryId: null, destinationType: null });
      expect(result.status).toBe('failed');
      expect(result.failureCode).toBe('MISSING_BENEFICIARY');
      expect(result.providerPayoutReference).toBeNull();
    });
  });

  describe('getPayoutStatus', () => {
    it('reports successful for a reference it recognises', async () => {
      const result = await adapter.getPayoutStatus('SANDBOX-DISB-PAYOUT-abc123');
      expect(result.status).toBe('successful');
    });

    it('reports failed for an unrecognised reference rather than guessing', async () => {
      const result = await adapter.getPayoutStatus('SOME-OTHER-REFERENCE');
      expect(result.status).toBe('failed');
      expect(result.failureCode).toBe('UNKNOWN_REFERENCE');
    });
  });

  describe('validateBeneficiary', () => {
    it('accepts a masked destination value', async () => {
      const result = await adapter.validateBeneficiary({ destinationType: 'mobile_wallet', maskedDestinationValue: '****5678' });
      expect(result.valid).toBe(true);
    });

    it('rejects an empty/placeholder destination value', async () => {
      const result = await adapter.validateBeneficiary({ destinationType: 'bank_account', maskedDestinationValue: '—' });
      expect(result.valid).toBe(false);
    });
  });

  describe('verifyWebhook — honest about having no live signing key', () => {
    it('always reports invalid in sandbox mode rather than pretending to verify', async () => {
      const result = await adapter.verifyWebhook('{}', 'some-signature');
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/no live webhook signing key/i);
    });
  });
});
