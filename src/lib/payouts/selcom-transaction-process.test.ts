// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapSelcomTransactionStatus } from './selcom-status-mapping';
import { SelcomTimeoutError } from '@/lib/selcom/errors';

const INTEGRATION_MIGRATION_PATH = join(
  __dirname, '..', '..', '..', 'supabase', 'migrations', '20260819000000_selcom_transaction_process_integration.sql'
);
const PAYOUTS_MIGRATION_PATH = join(
  __dirname, '..', '..', '..', 'supabase', 'migrations', '20260812000000_create_merchant_payouts.sql'
);

// ── Requirements: "Treat ACCEPTED as pending, not successful" / "Treat
// COMPLETED only according to official response semantics" / "Do not mark
// settlement complete until final confirmation" ────────────────────────
describe('mapSelcomTransactionStatus — the three documented status values, and nothing else, ever means success', () => {
  it('ACCEPTED (documented as "async" — received/queued, not finalized) maps to processing', () => {
    expect(mapSelcomTransactionStatus('ACCEPTED')).toBe('processing');
  });

  it('COMPLETED (documented as "sync" — finished) is the only status that maps to successful', () => {
    expect(mapSelcomTransactionStatus('COMPLETED')).toBe('successful');
  });

  it('FAILED maps to failed', () => {
    expect(mapSelcomTransactionStatus('FAILED')).toBe('failed');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(mapSelcomTransactionStatus(' completed ')).toBe('successful');
    expect(mapSelcomTransactionStatus('accepted')).toBe('processing');
  });

  // Updated by the status-check-service work (20260820000000): an
  // unrecognised/missing status now maps to the honest 'unknown' rather
  // than being folded into 'processing' — distinct internal states for
  // "Selcom says it's still going" vs "we don't know what Selcom said".
  // Never 'successful' either way — that's the property this test still
  // protects.
  it('never optimistically reports success for an undocumented, missing, or malformed status', () => {
    expect(mapSelcomTransactionStatus('PENDING')).toBe('unknown');
    expect(mapSelcomTransactionStatus('SUCCESS')).toBe('unknown');
    expect(mapSelcomTransactionStatus('')).toBe('unknown');
    expect(mapSelcomTransactionStatus(undefined)).toBe('unknown');
    expect(mapSelcomTransactionStatus(null)).toBe('unknown');
  });
});

// ── SelcomDisbursementAdapter behaviour: accepted/completed responses and
// network timeouts, tested against a mocked transaction-process module so
// no real HTTP call is ever made. ───────────────────────────────────────
const mockInitiateDisbursement = vi.fn();
vi.mock('@/lib/selcom/transaction-process', () => ({
  initiateDisbursement: (...args: unknown[]) => mockInitiateDisbursement(...args),
}));
vi.mock('@/lib/selcom/transaction-status', () => ({
  queryTransactionStatus: vi.fn(),
}));

const { SelcomDisbursementAdapter } = await import('./selcom-disbursement-adapter');

beforeEach(() => {
  mockInitiateDisbursement.mockReset();
});

const BASE_REQUEST = {
  payoutId: 'payout-1',
  payoutReference: 'PAY-2026-0001',
  idempotencyKey: 'PAYOUT-abc123',
  merchantId: 'merchant-1',
  beneficiaryId: 'beneficiary-1',
  destinationType: 'bank_account' as const,
  institutionCode: 'CRDB',
  recipientAccount: '255700000000',
  recipientName: 'Jane Merchant',
  amount: '97000.00',
  currency: 'TZS',
};

describe('SelcomDisbursementAdapter.submitPayout — accepted (pending) response', () => {
  it('reports processing, not successful, for a documented ACCEPTED response', async () => {
    mockInitiateDisbursement.mockResolvedValueOnce({
      data: { trans_id: 'PAY-2026-0001', selcom_receipt: 'RCPT-1', status: 'ACCEPTED', amount: 97000, currency: 'TZS' },
      result: 'SUCCESS',
      resultCode: '000',
      correlationId: 'corr-1',
    });
    const adapter = new SelcomDisbursementAdapter();
    const result = await adapter.submitPayout(BASE_REQUEST);
    expect(result.status).toBe('processing');
    expect(result.failureCode).toBeNull();
    expect(result.providerPayoutReference).toBe('RCPT-1');
  });
});

describe('SelcomDisbursementAdapter.submitPayout — completed response', () => {
  it('reports successful only for a documented COMPLETED response', async () => {
    mockInitiateDisbursement.mockResolvedValueOnce({
      data: { trans_id: 'PAY-2026-0001', selcom_receipt: 'RCPT-1', status: 'COMPLETED', amount: 97000, currency: 'TZS' },
      result: 'SUCCESS',
      resultCode: '000',
      correlationId: 'corr-2',
    });
    const adapter = new SelcomDisbursementAdapter();
    const result = await adapter.submitPayout(BASE_REQUEST);
    expect(result.status).toBe('successful');
    expect(result.providerPayoutReference).toBe('RCPT-1');
  });
});

describe('SelcomDisbursementAdapter.submitPayout — network timeout', () => {
  it('is caught and reported as a controlled failure, never thrown, never treated as success', async () => {
    mockInitiateDisbursement.mockRejectedValueOnce(
      new SelcomTimeoutError('Selcom request to /v1/transaction/process timed out after 15000ms', 15000, 'corr-3')
    );
    const adapter = new SelcomDisbursementAdapter();
    const result = await adapter.submitPayout(BASE_REQUEST);
    expect(result.status).toBe('failed');
    expect(result.failureCode).toBe('TIMEOUT');
    expect(result.providerPayoutReference).toBeNull();
    expect(result.failureReason).toMatch(/timed out/i);
  });

  it('is never automatically retried — exactly one call to initiateDisbursement per submitPayout() invocation', async () => {
    mockInitiateDisbursement.mockRejectedValueOnce(new SelcomTimeoutError('timed out', 15000, 'corr-4'));
    const adapter = new SelcomDisbursementAdapter();
    await adapter.submitPayout(BASE_REQUEST);
    expect(mockInitiateDisbursement).toHaveBeenCalledTimes(1);
  });
});

describe('SelcomDisbursementAdapter — purpose and debit-account handling', () => {
  it('always sends purpose FT, and never an invented debit/sender-account field', async () => {
    mockInitiateDisbursement.mockResolvedValueOnce({
      data: { trans_id: 'PAY-2026-0001', selcom_receipt: 'RCPT-1', status: 'COMPLETED', amount: 97000, currency: 'TZS' },
      result: 'SUCCESS',
      resultCode: '000',
      correlationId: 'corr-5',
    });
    const adapter = new SelcomDisbursementAdapter();
    await adapter.submitPayout(BASE_REQUEST);
    const sentFields = mockInitiateDisbursement.mock.calls[0][0];
    expect(sentFields.purpose).toBe('FT');
    expect(Object.keys(sentFields).sort()).toEqual(
      ['amount', 'purpose', 'recipientAccount', 'recipientFiCode', 'recipientName', 'remarks', 'transId'].sort()
    );
  });

  it('uses the internal payout reference as transId', async () => {
    mockInitiateDisbursement.mockResolvedValueOnce({
      data: { trans_id: 'PAY-2026-0001', selcom_receipt: 'RCPT-1', status: 'COMPLETED', amount: 97000, currency: 'TZS' },
      result: 'SUCCESS',
      resultCode: '000',
      correlationId: 'corr-6',
    });
    const adapter = new SelcomDisbursementAdapter();
    await adapter.submitPayout(BASE_REQUEST);
    expect(mockInitiateDisbursement.mock.calls[0][0].transId).toBe(BASE_REQUEST.payoutReference);
  });
});

// ── Database-level guarantees. These cannot be exercised against a live
// Postgres instance in this test suite (no DB is spun up for unit tests
// anywhere in this codebase — see every other *-permissions.test.ts for
// the same convention), so each is verified directly against the applied
// migration source, the same approach payouts-permissions.test.ts already
// uses for "is only ever granted to..." and "revoked from anon"
// guarantees. ─────────────────────────────────────────────────────────
describe('Database-level guarantees — verified against the migration source', () => {
  const integrationMigration = readFileSync(INTEGRATION_MIGRATION_PATH, 'utf8');
  const payoutsMigration = readFileSync(PAYOUTS_MIGRATION_PATH, 'utf8');
  const checklistFn = integrationMigration.slice(
    integrationMigration.indexOf('create or replace function begin_merchant_payout_submission'),
    integrationMigration.indexOf('revoke execute on function begin_merchant_payout_submission')
  );

  it('duplicate transId is structurally impossible — payout_reference (used as transId) has a database unique constraint', () => {
    expect(payoutsMigration).toMatch(/payout_reference text not null unique/);
  });

  it('duplicate idempotency key is structurally impossible — idempotency_key has a database unique constraint', () => {
    expect(payoutsMigration).toMatch(/idempotency_key text not null unique/);
  });

  it('an unverified beneficiary blocks submission', () => {
    expect(checklistFn).toContain("v_beneficiary.verification_status <> 'verified'");
  });

  it('a beneficiary still within its cooling period blocks submission', () => {
    expect(checklistFn).toContain('cooling_period_ends_at > now()');
  });

  it('an unreconciled transaction blocks submission', () => {
    expect(checklistFn).toContain("reconciliation_status <> 'matched'");
  });

  it('a merchant that is not active ("held") blocks submission', () => {
    expect(checklistFn).toContain("v_merchant.status <> 'active'");
  });

  it('a merchant on compliance hold blocks submission', () => {
    expect(checklistFn).toContain('v_merchant.compliance_hold');
  });

  it('an active settlement/chargeback hold on the merchant blocks submission', () => {
    expect(checklistFn).toContain("status = 'active'");
    expect(checklistFn).toContain('settlement_holds');
  });

  it('KYC must be confirmed and the till must be active', () => {
    expect(checklistFn).toContain("partner_decision = 'approved'");
    expect(checklistFn).toContain("status = 'active'");
  });

  it('a compliance-held or cancelled/failed settlement batch blocks submission', () => {
    expect(checklistFn).toContain('v_batch.compliance_hold');
    expect(checklistFn).toContain("v_batch.status in ('cancelled', 'failed')");
  });

  it('maker and approver must be different users — enforced in approve_merchant_payout, a separate stage from submission', () => {
    expect(payoutsMigration).toContain('v_payout.requested_by = v_performer');
    expect(payoutsMigration).toContain('Maker-checker violation: the approver must be different from the requester');
  });

  it('amount greater than zero is a table CHECK constraint, not application logic that could be bypassed', () => {
    expect(payoutsMigration).toMatch(/amount numeric\(14, 2\) not null check \(amount > 0\)/);
  });

  it('the beneficiary institution code must be a recognised, approved Selcom code — never free text', () => {
    expect(checklistFn).toContain('selcom_institution_codes');
    expect(checklistFn).toContain('is_active');
  });

  it('decrypt_beneficiary_destination_for_payout is the only decrypt path, gated by payouts.submit, and independently re-checks verification', () => {
    const fn = integrationMigration.slice(
      integrationMigration.indexOf('create or replace function decrypt_beneficiary_destination_for_payout'),
      integrationMigration.indexOf('revoke execute on function decrypt_beneficiary_destination_for_payout')
    );
    expect(fn).toContain(`has_permission('payouts.submit')`);
    expect(fn).toContain("v_status <> 'verified'");
  });

  it('every new/modified mutating function in this migration is revoked from anon', () => {
    for (const fn of [
      'decrypt_beneficiary_destination_for_payout(uuid, text)',
      'begin_merchant_payout_submission(uuid)',
      'apply_merchant_payout_result(uuid, text, text, text, text, text, text, text, jsonb, text)',
    ]) {
      expect(integrationMigration).toContain(`revoke execute on function ${fn} from anon`);
    }
  });

  it('fixes the overload bug from the previous migration instead of leaving a stale duplicate function', () => {
    expect(integrationMigration).toContain('drop function if exists apply_merchant_payout_result(uuid, text, text, text, text)');
    expect(integrationMigration).toContain(
      'drop function if exists request_merchant_beneficiary_change(\n  uuid, uuid, text, text, text, text, text, text, text, text, boolean, text, text\n)'
    );
  });
});
