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

function makeSupabase(config: { rpc?: { data: unknown; error?: unknown }; from: Record<string, Array<{ data: unknown; error?: unknown }>> }) {
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
  return {
    from: (table: string) => builder(table),
    rpc: () => Promise.resolve(config.rpc ?? { data: 'INV-2026-0001', error: null }),
    __insertCalls: insertCalls,
  } as never as { from: (t: string) => unknown; rpc: () => Promise<unknown>; __insertCalls: typeof insertCalls };
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { updateProformaLineItems, convertProformaToInvoice } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('updateProformaLineItems — quantity x unit price rolls into fee columns', () => {
  it('rejects a role without proformas.update', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await updateProformaLineItems('pro-1', []);
    expect(result.success).toBe(false);
  });

  it('refuses to edit line items once the proforma has been approved', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cfo@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(
      makeSupabase({ from: { proforma_invoices: [{ data: { status: 'approved', discount: 0, tax_percentage: 18 } }] } })
    );

    const result = await updateProformaLineItems('pro-1', [{ category: 'setup_fee', description: 'x', quantity: 1, unit_price: 1000 }]);
    expect(result.success).toBe(false);
  });

  it('sums quantity x unit_price into the matching fee column and recomputes totals', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cfo@bizlinkafrica.net' });
    const supabase = makeSupabase({
      from: {
        proforma_invoices: [{ data: { status: 'draft', discount: 0, tax_percentage: 18 } }, { data: null, error: null }],
        proforma_line_items: [{ data: null, error: null }, { data: null, error: null }],
      },
    });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await updateProformaLineItems('pro-1', [
      { category: 'consulting_fee', description: 'Strategy', quantity: 2, unit_price: 100000 },
    ]);

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'update_line_items', newValue: expect.objectContaining({ itemCount: 1 }) })
    );
  });
});

describe('convertProformaToInvoice — carries fee totals and line items over', () => {
  it('rejects a role without proformas.convert', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await convertProformaToInvoice('pro-1');
    expect(result.success).toBe(false);
  });

  it('refuses to convert a proforma that was already converted', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cfo@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(
      makeSupabase({ from: { proforma_invoices: [{ data: { id: 'pro-1', converted_invoice_id: 'inv-existing' } }] } })
    );

    const result = await convertProformaToInvoice('pro-1');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/already been converted/);
  });

  it('copies the source proforma line items onto the new invoice', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cfo@bizlinkafrica.net' });
    const supabase = makeSupabase({
      rpc: { data: 'INV-2026-0001' },
      from: {
        proforma_invoices: [
          { data: { id: 'pro-1', converted_invoice_id: null, total: 118000, valid_until: '2026-08-01', setup_fee: 100000, currency: 'TZS' } },
          { data: null, error: null },
        ],
        invoices: [{ data: { id: 'inv-1' } }],
        proforma_line_items: [
          { data: [{ category: 'setup_fee', description: 'Initial setup', quantity: 1, unit_price: 100000, line_total: 100000 }] },
        ],
        invoice_line_items: [{ data: null, error: null }],
      },
    });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await convertProformaToInvoice('pro-1');

    expect(result.success).toBe(true);
    expect(result.invoiceId).toBe('inv-1');
    const lineItemInsert = supabase.__insertCalls.find((c) => c.table === 'invoice_line_items');
    expect(lineItemInsert).toBeDefined();
    expect(lineItemInsert?.payload).toEqual([
      expect.objectContaining({ category: 'setup_fee', line_total: 100000, invoice_id: 'inv-1' }),
    ]);
  });
});
