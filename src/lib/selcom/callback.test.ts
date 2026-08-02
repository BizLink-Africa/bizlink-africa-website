// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  selcomCallbackSchema,
  timingSafeStringEqual,
  maskCallbackAccountNumber,
  shouldAlertOnCallbackOutcome,
  processSelcomCallback,
  notifyCallbackFailure,
  getLiveCallbackTestUrl,
} from './callback';

describe('selcomCallbackSchema — strict request schema', () => {
  it('accepts a minimal payload with only the two always-present fields', () => {
    const result = selcomCallbackSchema.safeParse({ reference_id: 'TRX-1', status: 'SUCCESS' });
    expect(result.success).toBe(true);
  });

  it('accepts every documented optional field', () => {
    const result = selcomCallbackSchema.safeParse({
      reference_id: 'TRX-1',
      status: 'SUCCESS',
      sender_account_name: 'Jane Doe',
      sender_account_number: '0123456789',
      recipient_name: 'John Doe',
      recipient_account_number: '9876543210',
      amount: 5000,
      charges: [{ fee: 100 }],
      selcom_receipt: 'SBS-123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a payload missing reference_id', () => {
    expect(selcomCallbackSchema.safeParse({ status: 'SUCCESS' }).success).toBe(false);
  });

  it('rejects a payload missing status', () => {
    expect(selcomCallbackSchema.safeParse({ reference_id: 'TRX-1' }).success).toBe(false);
  });

  it('rejects an empty-string reference_id', () => {
    expect(selcomCallbackSchema.safeParse({ reference_id: '', status: 'SUCCESS' }).success).toBe(false);
  });

  it('accepts amount as either a number or a string, per the wire-format ambiguity already handled elsewhere in this integration', () => {
    expect(selcomCallbackSchema.safeParse({ reference_id: 'TRX-1', status: 'SUCCESS', amount: 5000 }).success).toBe(true);
    expect(selcomCallbackSchema.safeParse({ reference_id: 'TRX-1', status: 'SUCCESS', amount: '5000.00' }).success).toBe(true);
  });

  it('does not choke on an unexpected extra field (strips rather than rejects, matching zod default behaviour)', () => {
    const result = selcomCallbackSchema.safeParse({ reference_id: 'TRX-1', status: 'SUCCESS', unexpected_field: 'x' });
    expect(result.success).toBe(true);
  });
});

describe('timingSafeStringEqual', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeStringEqual('same-secret', 'same-secret')).toBe(true);
  });

  it('returns false for different strings of the same length', () => {
    expect(timingSafeStringEqual('same-secretA', 'same-secretB')).toBe(false);
  });

  it('returns false (without throwing) for different-length strings', () => {
    expect(() => timingSafeStringEqual('short', 'a-much-longer-secret')).not.toThrow();
    expect(timingSafeStringEqual('short', 'a-much-longer-secret')).toBe(false);
  });

  it('returns false for an empty candidate against a real secret', () => {
    expect(timingSafeStringEqual('', 'a-real-secret')).toBe(false);
  });
});

describe('maskCallbackAccountNumber', () => {
  it('masks a raw account number down to the last 4 characters', () => {
    expect(maskCallbackAccountNumber('0123456789')).toBe('****6789');
  });

  it('returns null for undefined (the field was absent from the callback)', () => {
    expect(maskCallbackAccountNumber(undefined)).toBeNull();
  });

  it('never returns the full raw value for a long account number', () => {
    const raw = '255700000000';
    const masked = maskCallbackAccountNumber(raw);
    expect(masked).not.toBe(raw);
    expect(masked).not.toContain(raw.slice(0, 6));
  });
});

describe('shouldAlertOnCallbackOutcome', () => {
  it('alerts on genuine anomalies', () => {
    for (const outcome of ['reference_not_found', 'unexpected_status', 'amount_mismatch', 'destination_mismatch', 'invalid_state']) {
      expect(shouldAlertOnCallbackOutcome(outcome)).toBe(true);
    }
  });

  it('never alerts on routine, expected outcomes', () => {
    for (const outcome of ['processed', 'duplicate', 'dry_run_ok']) {
      expect(shouldAlertOnCallbackOutcome(outcome)).toBe(false);
    }
  });
});

describe('processSelcomCallback — thin RPC wrapper', () => {
  it('passes every field through to process_selcom_callback with the correct parameter names', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ outcome: 'processed', payout_id: 'p1', rejection_reason: null }], error: null });
    const result = await processSelcomCallback(
      { rpc },
      {
        referenceId: 'TRX-1',
        rawStatus: 'SUCCESS',
        selcomReceipt: 'SBS-1',
        amount: '5000.00',
        maskedSenderAccountNumber: null,
        senderAccountName: null,
        maskedRecipientAccountNumber: '****6789',
        recipientName: 'John Doe',
        charges: null,
        sourceIp: '1.2.3.4',
        performedBy: 'selcom_callback',
      }
    );

    expect(rpc).toHaveBeenCalledWith('process_selcom_callback', {
      p_reference_id: 'TRX-1',
      p_raw_status: 'SUCCESS',
      p_selcom_receipt: 'SBS-1',
      p_amount: '5000.00',
      p_masked_sender_account_number: null,
      p_sender_account_name: null,
      p_masked_recipient_account_number: '****6789',
      p_recipient_name: 'John Doe',
      p_charges: null,
      p_source_ip: '1.2.3.4',
      p_performed_by: 'selcom_callback',
      p_dry_run: false,
    });
    expect(result).toEqual({ outcome: 'processed', payoutId: 'p1', rejectionReason: null });
  });

  it('defaults dryRun to false when omitted', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ outcome: 'processed', payout_id: 'p1', rejection_reason: null }], error: null });
    await processSelcomCallback(
      { rpc },
      {
        referenceId: 'TRX-1', rawStatus: 'SUCCESS', selcomReceipt: null, amount: null,
        maskedSenderAccountNumber: null, senderAccountName: null, maskedRecipientAccountNumber: null,
        recipientName: null, charges: null, sourceIp: null, performedBy: 'selcom_callback',
      }
    );
    expect(rpc).toHaveBeenCalledWith('process_selcom_callback', expect.objectContaining({ p_dry_run: false }));
  });

  it('throws when the RPC itself errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'db unavailable' } });
    await expect(
      processSelcomCallback(
        { rpc },
        {
          referenceId: 'TRX-1', rawStatus: 'SUCCESS', selcomReceipt: null, amount: null,
          maskedSenderAccountNumber: null, senderAccountName: null, maskedRecipientAccountNumber: null,
          recipientName: null, charges: null, sourceIp: null, performedBy: 'selcom_callback',
        }
      )
    ).rejects.toThrow('db unavailable');
  });

  it('throws when the RPC returns no row', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    await expect(
      processSelcomCallback(
        { rpc },
        {
          referenceId: 'TRX-1', rawStatus: 'SUCCESS', selcomReceipt: null, amount: null,
          maskedSenderAccountNumber: null, senderAccountName: null, maskedRecipientAccountNumber: null,
          recipientName: null, charges: null, sourceIp: null, performedBy: 'selcom_callback',
        }
      )
    ).rejects.toThrow('process_selcom_callback returned no result.');
  });
});

describe('notifyCallbackFailure', () => {
  it('inserts an admin_notifications row for an alertable outcome, never a raw account number', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert });

    await notifyCallbackFailure({ from }, 'destination_mismatch', 'TRX-1', 'Callback destination account does not match.', 'payout-1');

    expect(from).toHaveBeenCalledWith('admin_notifications');
    const payload = insert.mock.calls[0][0];
    expect(payload.priority).toBe('urgent');
    expect(payload.related_record_id).toBe('payout-1');
    expect(JSON.stringify(payload)).not.toMatch(/\d{6,}/); // no long raw digit run (account number)
  });

  it('never inserts anything for a routine outcome', async () => {
    const insert = vi.fn();
    const from = vi.fn().mockReturnValue({ insert });

    await notifyCallbackFailure({ from }, 'processed', 'TRX-1', null, 'payout-1');
    await notifyCallbackFailure({ from }, 'duplicate', 'TRX-1', null, 'payout-1');
    await notifyCallbackFailure({ from }, 'dry_run_ok', 'TRX-1', null, 'payout-1');

    expect(from).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('never throws even if the insert itself fails', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: 'insert failed' } });
    const from = vi.fn().mockReturnValue({ insert });

    await expect(notifyCallbackFailure({ from }, 'amount_mismatch', 'TRX-1', 'mismatch', null)).resolves.toBeUndefined();
  });
});

describe('getLiveCallbackTestUrl — the only place besides config.ts/status.ts allowed to touch the raw callback secret', () => {
  const originalAdminUrl = process.env.NEXT_PUBLIC_ADMIN_URL;
  const originalSecret = process.env.SELCOM_CALLBACK_SECRET;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_ADMIN_URL = originalAdminUrl;
    process.env.SELCOM_CALLBACK_SECRET = originalSecret;
  });

  it('builds the exact callback route URL when both env vars are set', () => {
    process.env.NEXT_PUBLIC_ADMIN_URL = 'https://admin.example.com/';
    process.env.SELCOM_CALLBACK_SECRET = 'test-secret';
    const result = getLiveCallbackTestUrl();
    expect(result).toEqual({ url: 'https://admin.example.com/api/integrations/selcom/callback/test-secret' });
  });

  it('returns an error rather than a broken URL when either env var is missing', () => {
    process.env.NEXT_PUBLIC_ADMIN_URL = '';
    process.env.SELCOM_CALLBACK_SECRET = 'test-secret';
    expect('error' in getLiveCallbackTestUrl()).toBe(true);
  });
});
