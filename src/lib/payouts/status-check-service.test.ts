// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';

const queryTransactionStatusMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/selcom/transaction-status', () => ({
  queryTransactionStatus: queryTransactionStatusMock,
}));

import { checkPayoutStatus, type PayoutForStatusCheck } from './status-check-service';
import { SelcomApiError, SelcomNetworkError } from '@/lib/selcom/errors';
import { getBackoffMinutes } from './selcom-status-mapping';

function makePayout(overrides: Partial<PayoutForStatusCheck> = {}): PayoutForStatusCheck {
  return { id: 'payout-1', payout_reference: 'TRX-123', status_check_count: 0, ...overrides };
}

function makeSupabase() {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  return { rpc };
}

beforeEach(() => {
  queryTransactionStatusMock.mockReset();
});

describe('checkPayoutStatus — always queries by the payout\'s own transId, never a Selcom receipt', () => {
  it('passes payout_reference as transId, never provider_payout_reference', async () => {
    queryTransactionStatusMock.mockResolvedValue({
      result: 'SUCCESS',
      resultCode: '000',
      data: { status: 'COMPLETED', selcomReceipt: 'SBS-999' },
    });
    const supabase = makeSupabase();
    const payout = makePayout({ payout_reference: 'TRX-ABC' });

    await checkPayoutStatus(supabase, payout, { triggerType: 'manual', performedBy: 'staff@bizlink.africa' });

    expect(queryTransactionStatusMock).toHaveBeenCalledWith({ transId: 'TRX-ABC' });
  });
});

describe('checkPayoutStatus — successful query with a documented status', () => {
  it('COMPLETED maps to successful and calls apply_payout_status_check_result with backoff for the next attempt', async () => {
    queryTransactionStatusMock.mockResolvedValue({
      result: 'SUCCESS',
      resultCode: '000',
      data: { status: 'COMPLETED', selcomReceipt: 'SBS-999' },
    });
    const supabase = makeSupabase();
    supabase.rpc.mockImplementation((fn: string) => {
      if (fn === 'apply_payout_status_check_result') {
        return Promise.resolve({ data: [{ applied: true, skip_reason: null, new_status: 'successful' }], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    const payout = makePayout({ status_check_count: 2 });

    const outcome = await checkPayoutStatus(supabase, payout, { triggerType: 'scheduled', performedBy: 'system' });

    expect(outcome).toMatchObject({
      querySucceeded: true,
      externalStatus: 'COMPLETED',
      mappedStatus: 'successful',
      selcomReceipt: 'SBS-999',
      applied: true,
      skipReason: null,
      errorMessage: null,
    });

    const applyCall = supabase.rpc.mock.calls.find((c) => c[0] === 'apply_payout_status_check_result');
    expect(applyCall).toBeDefined();
    expect(applyCall![1]).toMatchObject({
      p_payout_id: 'payout-1',
      p_mapped_status: 'successful',
      p_external_status: 'COMPLETED',
      p_selcom_receipt: 'SBS-999',
      p_provider_payout_reference: 'SBS-999',
      p_failure_code: null,
      p_failure_reason: null,
      p_performed_by: 'system',
      p_backoff_minutes: getBackoffMinutes(payout.status_check_count + 1),
    });

    // record_payout_status_check is always called, unconditionally
    const recordCall = supabase.rpc.mock.calls.find((c) => c[0] === 'record_payout_status_check');
    expect(recordCall).toBeDefined();
    expect(recordCall![1]).toMatchObject({
      p_payout_id: 'payout-1',
      p_trans_id: 'TRX-123',
      p_trigger_type: 'scheduled',
      p_query_succeeded: true,
      p_external_status: 'COMPLETED',
      p_mapped_status: 'successful',
      p_status_applied: true,
      p_skip_reason: null,
    });
  });

  it('FAILED maps to failed and sends a failure_code/failure_reason', async () => {
    queryTransactionStatusMock.mockResolvedValue({
      result: 'FAIL',
      resultCode: '999',
      data: { status: 'FAILED', selcomReceipt: null },
    });
    const supabase = makeSupabase();
    const payout = makePayout();

    await checkPayoutStatus(supabase, payout, { triggerType: 'manual', performedBy: 'staff@bizlink.africa' });

    const applyCall = supabase.rpc.mock.calls.find((c) => c[0] === 'apply_payout_status_check_result');
    expect(applyCall![1]).toMatchObject({
      p_mapped_status: 'failed',
      p_failure_code: 'SELCOM_REPORTED_FAILED',
      p_failure_reason: 'Selcom reported status: FAILED',
    });
  });

  it('ACCEPTED maps to processing (not yet finalised)', async () => {
    queryTransactionStatusMock.mockResolvedValue({
      result: 'SUCCESS',
      resultCode: '000',
      data: { status: 'ACCEPTED', selcomReceipt: null },
    });
    const supabase = makeSupabase();

    const outcome = await checkPayoutStatus(supabase, makePayout(), { triggerType: 'manual', performedBy: 'staff@bizlink.africa' });

    expect(outcome.mappedStatus).toBe('processing');
  });

  it('an undocumented/unrecognised status maps to unknown, never optimistically to successful or failed', async () => {
    queryTransactionStatusMock.mockResolvedValue({
      result: 'SUCCESS',
      resultCode: '000',
      data: { status: 'SOME_NEW_STATUS', selcomReceipt: null },
    });
    const supabase = makeSupabase();

    const outcome = await checkPayoutStatus(supabase, makePayout(), { triggerType: 'scheduled', performedBy: 'system' });

    expect(outcome.mappedStatus).toBe('unknown');
  });
});

describe('checkPayoutStatus — a failed query is never treated as evidence the transaction failed', () => {
  it('a thrown SelcomApiError (e.g. 404) records the attempt but never calls apply_payout_status_check_result', async () => {
    queryTransactionStatusMock.mockRejectedValue(new SelcomApiError('Not found', 404, null, '404', 'FAIL'));
    const supabase = makeSupabase();

    const outcome = await checkPayoutStatus(supabase, makePayout(), { triggerType: 'scheduled', performedBy: 'system' });

    expect(outcome.querySucceeded).toBe(false);
    expect(outcome.mappedStatus).toBeNull();
    expect(outcome.applied).toBe(false);

    const applyCall = supabase.rpc.mock.calls.find((c) => c[0] === 'apply_payout_status_check_result');
    expect(applyCall).toBeUndefined();

    const recordCall = supabase.rpc.mock.calls.find((c) => c[0] === 'record_payout_status_check');
    expect(recordCall).toBeDefined();
    expect(recordCall![1]).toMatchObject({
      p_query_succeeded: false,
      p_http_status: 404,
      p_external_status: null,
      p_mapped_status: null,
      p_status_applied: false,
    });
    expect(recordCall![1].p_error_message).toBeTruthy();
  });

  it('a network error also records the attempt as failed without applying any status', async () => {
    queryTransactionStatusMock.mockRejectedValue(new SelcomNetworkError('ECONNRESET', new Error('boom')));
    const supabase = makeSupabase();

    const outcome = await checkPayoutStatus(supabase, makePayout(), { triggerType: 'manual', performedBy: 'staff@bizlink.africa' });

    expect(outcome.querySucceeded).toBe(false);
    expect(supabase.rpc.mock.calls.find((c) => c[0] === 'apply_payout_status_check_result')).toBeUndefined();
  });
});

describe('checkPayoutStatus — respects the guard function\'s verdict rather than assuming success', () => {
  it('reflects applied:false and the skip_reason when the database guard rejects the update (e.g. already finalised)', async () => {
    queryTransactionStatusMock.mockResolvedValue({
      result: 'SUCCESS',
      resultCode: '000',
      data: { status: 'COMPLETED', selcomReceipt: 'SBS-1' },
    });
    const supabase = makeSupabase();
    supabase.rpc.mockImplementation((fn: string) => {
      if (fn === 'apply_payout_status_check_result') {
        return Promise.resolve({
          data: [{ applied: false, skip_reason: 'payout_already_finalised', new_status: 'successful' }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const outcome = await checkPayoutStatus(supabase, makePayout(), { triggerType: 'scheduled', performedBy: 'system' });

    expect(outcome.applied).toBe(false);
    expect(outcome.skipReason).toBe('payout_already_finalised');

    const recordCall = supabase.rpc.mock.calls.find((c) => c[0] === 'record_payout_status_check');
    expect(recordCall![1]).toMatchObject({ p_status_applied: false, p_skip_reason: 'payout_already_finalised' });
  });
});

describe('checkPayoutStatus — always records the attempt, even when the apply RPC itself errors', () => {
  it('surfaces the RPC error message and still logs the attempt', async () => {
    queryTransactionStatusMock.mockResolvedValue({
      result: 'SUCCESS',
      resultCode: '000',
      data: { status: 'COMPLETED', selcomReceipt: 'SBS-1' },
    });
    const supabase = makeSupabase();
    supabase.rpc.mockImplementation((fn: string) => {
      if (fn === 'apply_payout_status_check_result') {
        return Promise.resolve({ data: null, error: { message: 'db unavailable' } });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const outcome = await checkPayoutStatus(supabase, makePayout(), { triggerType: 'scheduled', performedBy: 'system' });

    expect(outcome.errorMessage).toBe('db unavailable');
    expect(supabase.rpc.mock.calls.find((c) => c[0] === 'record_payout_status_check')).toBeDefined();
  });
});
