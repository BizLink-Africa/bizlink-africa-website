// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockHeaders = vi.fn();
vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

let inserted: Record<string, unknown> | null = null;
const mockStaffProfileResult: { data: { role: string } | null } = { data: null };

function makeSupabase() {
  return {
    from: (table: string) => {
      const b: Record<string, unknown> = {
        select: () => b,
        eq: () => b,
        maybeSingle: () => Promise.resolve(mockStaffProfileResult),
        insert: (row: Record<string, unknown>) => {
          if (table === 'audit_logs') inserted = row;
          return Promise.resolve({ error: null });
        },
      };
      return b;
    },
  };
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { logAuditEvent } = await import('./audit');

describe('logAuditEvent — auto-populated fields ("Record actor, role, action, module, record, old values, new values, reason, timestamp, IP, user agent, correlation ID")', () => {
  beforeEach(() => {
    inserted = null;
    mockStaffProfileResult.data = null;
    mockCreateClient.mockReturnValue(makeSupabase());
    mockHeaders.mockResolvedValue(new Map());
  });

  it('auto-derives role from staff_profiles when not supplied', async () => {
    mockStaffProfileResult.data = { role: 'finance_approver' };
    await logAuditEvent({ performedBy: 'approver@bizlink.africa', actionType: 'settlement_approved', module: 'settlement_batches' });
    expect(inserted?.role).toBe('finance_approver');
  });

  it('leaves role null when the performer has no staff_profiles row (e.g. a merchant)', async () => {
    mockStaffProfileResult.data = null;
    await logAuditEvent({ performedBy: 'merchant@example.com', actionType: 'statement_exported', module: 'merchant_statements' });
    expect(inserted?.role).toBeNull();
  });

  it('respects an explicitly-supplied role and skips the staff_profiles lookup', async () => {
    mockStaffProfileResult.data = { role: 'should_not_be_used' };
    await logAuditEvent({ performedBy: 'x@bizlink.africa', actionType: 'x', module: 'x', role: 'finance_maker' });
    expect(inserted?.role).toBe('finance_maker');
  });

  it('auto-generates a correlation_id when none is supplied', async () => {
    await logAuditEvent({ performedBy: 'x@bizlink.africa', actionType: 'x', module: 'x' });
    expect(typeof inserted?.correlation_id).toBe('string');
    expect((inserted?.correlation_id as string).length).toBeGreaterThan(0);
  });

  it('respects an explicitly-supplied correlation_id', async () => {
    await logAuditEvent({ performedBy: 'x@bizlink.africa', actionType: 'x', module: 'x', correlationId: 'corr-123' });
    expect(inserted?.correlation_id).toBe('corr-123');
  });

  it('captures ip_address and user_agent from request headers when not supplied', async () => {
    mockHeaders.mockResolvedValue(new Map([['x-forwarded-for', '203.0.113.5, 10.0.0.1'], ['user-agent', 'TestAgent/1.0']]));
    await logAuditEvent({ performedBy: 'x@bizlink.africa', actionType: 'x', module: 'x' });
    expect(inserted?.ip_address).toBe('203.0.113.5');
    expect(inserted?.user_agent).toBe('TestAgent/1.0');
  });

  it('falls back to null ip/user-agent when headers() throws (no active request scope)', async () => {
    mockHeaders.mockRejectedValue(new Error('no request scope'));
    await expect(
      logAuditEvent({ performedBy: 'x@bizlink.africa', actionType: 'x', module: 'x' })
    ).resolves.toBeUndefined();
    expect(inserted?.ip_address).toBeNull();
    expect(inserted?.user_agent).toBeNull();
  });

  it('passes reason through when supplied, defaulting to null', async () => {
    await logAuditEvent({ performedBy: 'x@bizlink.africa', actionType: 'emergency_cancel', module: 'settlement_batches', reason: 'Compliance escalation' });
    expect(inserted?.reason).toBe('Compliance escalation');

    await logAuditEvent({ performedBy: 'x@bizlink.africa', actionType: 'x', module: 'x' });
    expect(inserted?.reason).toBeNull();
  });

  it('never throws even if the insert fails', async () => {
    mockCreateClient.mockReturnValue({
      from: () => ({
        select: function (this: unknown) { return this; },
        eq: function (this: unknown) { return this; },
        maybeSingle: () => Promise.resolve({ data: null }),
        insert: () => Promise.resolve({ error: { message: 'boom' } }),
      }),
    });
    await expect(
      logAuditEvent({ performedBy: 'x@bizlink.africa', actionType: 'x', module: 'x' })
    ).resolves.toBeUndefined();
  });
});
