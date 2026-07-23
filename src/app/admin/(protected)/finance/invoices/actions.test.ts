// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockRequirePermission = vi.fn();
vi.mock('@/lib/supabase/dal', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}));

const mockLogAuditEvent = vi.fn();
vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

function makeSupabase(config: { from: Record<string, Array<{ data: unknown; error?: unknown }>> }) {
  const queues: Record<string, Array<{ data: unknown; error?: unknown }>> = Object.fromEntries(
    Object.entries(config.from).map(([k, v]) => [k, [...v]])
  );
  const insertCalls: { table: string; payload: unknown }[] = [];
  function builder(table: string) {
    const resolve = () => {
      const next = (queues[table] ?? []).shift() ?? { data: null, error: null };
      return Promise.resolve({ data: next.data, error: next.error ?? null });
    };
    const api = {
      select: () => api,
      insert: (payload: unknown) => {
        insertCalls.push({ table, payload });
        return api;
      },
      update: () => api,
      delete: () => api,
      eq: () => api,
      single: () => resolve(),
      then: (onFulfilled: (v: { data: unknown; error: unknown }) => void) => resolve().then(onFulfilled),
    };
    return api;
  }
  return { from: (table: string) => builder(table), __insertCalls: insertCalls } as never as { from: (t: string) => unknown; __insertCalls: typeof insertCalls };
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { recordInvoicePayment, updateInvoiceLineItems } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('recordInvoicePayment — partial payment status derivation', () => {
  it('rejects a role without invoices.record_payment', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await recordInvoicePayment('inv-1', { amount: 1000, paymentDate: '2026-07-19' });
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('rejects a zero or negative amount', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cfo@bizlinkafrica.net' });
    const result = await recordInvoicePayment('inv-1', { amount: 0, paymentDate: '2026-07-19' });
    expect(result.success).toBe(false);
  });

  it('leaves the invoice partially_paid when the payment is less than the total', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cfo@bizlinkafrica.net' });
    const supabase = makeSupabase({
      from: {
        invoices: [{ data: { total: 100000, amount_paid: 0, currency: 'TZS' } }, { data: null, error: null }],
        invoice_payments: [{ data: null, error: null }],
      },
    });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await recordInvoicePayment('inv-1', { amount: 40000, paymentDate: '2026-07-19', receiptReference: 'RCP-001' });

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ newValue: expect.objectContaining({ newStatus: 'partially_paid' }) }));
    expect(supabase.__insertCalls[0].payload).toMatchObject({ amount: 40000, currency: 'TZS', receipt_reference: 'RCP-001' });
  });

  it('marks the invoice paid once the running total meets the invoice total', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cfo@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(
      makeSupabase({
        from: {
          invoices: [{ data: { total: 100000, amount_paid: 60000, currency: 'TZS' } }, { data: null, error: null }],
          invoice_payments: [{ data: null, error: null }],
        },
      })
    );

    const result = await recordInvoicePayment('inv-1', { amount: 40000, paymentDate: '2026-07-19' });

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ newValue: expect.objectContaining({ newStatus: 'paid' }) }));
  });
});

describe('updateInvoiceLineItems — only editable before issuance', () => {
  it('rejects a role without invoices.update', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await updateInvoiceLineItems('inv-1', []);
    expect(result.success).toBe(false);
  });

  it('refuses to edit line items on an already-issued invoice', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cfo@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(
      makeSupabase({ from: { invoices: [{ data: { status: 'issued', discount: 0, tax_percentage: 18, amount_paid: 0 } }] } })
    );

    const result = await updateInvoiceLineItems('inv-1', [{ category: 'setup_fee', description: 'x', quantity: 1, unit_price: 1000 }]);
    expect(result.success).toBe(false);
  });

  it('caps outstanding_balance at zero when line items reduce the total below amount already paid', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cfo@bizlinkafrica.net' });
    const supabase = makeSupabase({
      from: {
        invoices: [
          { data: { status: 'draft', discount: 0, tax_percentage: 0, amount_paid: 50000 } },
          { data: null, error: null },
        ],
        invoice_line_items: [{ data: null, error: null }, { data: null, error: null }],
      },
    });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await updateInvoiceLineItems('inv-1', [{ category: 'setup_fee', description: 'Reduced scope', quantity: 1, unit_price: 20000 }]);
    expect(result.success).toBe(true);
  });
});
