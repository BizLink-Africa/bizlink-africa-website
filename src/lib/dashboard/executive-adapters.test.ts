// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getExecutiveActionItems, EXECUTIVE_CATEGORIES } from './executive-adapters';

function makeSupabaseMock(dataByTable: Record<string, unknown[]>, singleByTable: Record<string, unknown> = {}) {
  function builder(table: string) {
    const api = {
      select: () => api,
      eq: () => api,
      in: () => api,
      single: () => Promise.resolve({ data: singleByTable[table] ?? null, error: null }),
      then: (resolve: (value: { data: unknown[]; error: null }) => void) => resolve({ data: dataByTable[table] ?? [], error: null }),
    };
    return api;
  }
  return { from: (table: string) => builder(table) } as never;
}

const TODAY = new Date();
const isoDaysAgo = (days: number) => new Date(TODAY.getTime() - days * 86400000).toISOString().slice(0, 10);
const isoDaysAhead = (days: number) => new Date(TODAY.getTime() + days * 86400000).toISOString().slice(0, 10);

describe('getExecutiveActionItems', () => {
  it('aggregates one real item per backed category, correctly tagged with department/priority', async () => {
    const supabase = makeSupabaseMock(
      {
        contracts: [
          { id: 'c1', contract_number: 'CON-1', contract_title: 'Approval Needed', status: 'pending_ceo_approval', end_date: null, renewal_notice_period_days: 30, created_at: '2026-01-01' },
          { id: 'c2', contract_number: 'CON-2', contract_title: 'Expiring Soon', status: 'active', end_date: isoDaysAhead(5), renewal_notice_period_days: 30, created_at: '2026-01-01' },
        ],
        expenses: [
          { id: 'e1', expense_number: 'EXP-1', description: 'Big purchase', amount: 600000, currency: 'TZS', status: 'pending_approval', created_at: '2026-01-01' },
          { id: 'e2', expense_number: 'EXP-2', description: 'Small purchase', amount: 10000, currency: 'TZS', status: 'pending_approval', created_at: '2026-01-01' },
        ],
        proforma_invoices: [
          { id: 'p1', proforma_number: 'PRO-1', client_business_name: 'Acme', total: 100000, currency: 'TZS', status: 'pending_approval', created_at: '2026-01-01' },
        ],
        invoices: [
          { id: 'i1', invoice_number: 'INV-1', client_business_name: 'Acme', total: 100000, currency: 'TZS', status: 'issued', due_date: isoDaysAgo(10), outstanding_balance: 50000, created_at: '2026-01-01' },
        ],
        website_leads: [
          { id: 'l1', business_name: 'Late Lead', status: 'contacted', follow_up_date: isoDaysAgo(3), created_at: '2026-01-01' },
        ],
        support_tickets: [
          { id: 't1', title: 'Urgent bug', status: 'open', priority: 'urgent', created_at: '2026-01-01' },
        ],
        integration_health: [
          { id: 'int1', service_type: 'Selcom', api_status: 'failed', error_message: 'Timeout', created_at: '2026-01-01' },
        ],
        security_events: [
          { id: 's1', event_type: 'suspicious_activity', severity: 'critical', description: 'Odd traffic', status: 'open', created_at: '2026-01-01' },
        ],
        compliance_reviews: [
          { id: 'r1', title: 'KYC Review', category: 'kyc', status: 'non_compliant', due_date: isoDaysAhead(2), created_at: '2026-01-01' },
        ],
      },
      { company_settings: { expense_high_value_threshold: 500000 } }
    );

    const items = await getExecutiveActionItems(supabase);

    // 2 contracts (pending approval + expiring soon) + 1 high-value expense
    // (the low-value one is excluded) + 1 each of proforma/invoice/lead/
    // ticket/integration/security/compliance = 10.
    expect(items).toHaveLength(10);

    const byCategory = new Map(items.map((i) => [i.category, i]));
    expect(byCategory.get(EXECUTIVE_CATEGORIES.CONTRACTS_PENDING_APPROVAL)).toMatchObject({ id: 'c1', department: 'Executive', priority: 'high' });
    expect(byCategory.get(EXECUTIVE_CATEGORIES.CONTRACTS_EXPIRING_SOON)).toMatchObject({ id: 'c2', department: 'Operations' });
    expect(byCategory.get(EXECUTIVE_CATEGORIES.HIGH_VALUE_EXPENSES)).toMatchObject({ id: 'e1', department: 'Finance' });
    expect(byCategory.get(EXECUTIVE_CATEGORIES.PROFORMAS_AWAITING_REVIEW)).toMatchObject({ id: 'p1', department: 'Finance' });
    expect(byCategory.get(EXECUTIVE_CATEGORIES.OVERDUE_INVOICES)).toMatchObject({ id: 'i1', department: 'Finance', priority: 'high' });
    expect(byCategory.get(EXECUTIVE_CATEGORIES.DELAYED_ONBOARDING)).toMatchObject({ id: 'l1', department: 'Operations' });
    expect(byCategory.get(EXECUTIVE_CATEGORIES.CRITICAL_SUPPORT)).toMatchObject({ id: 't1', department: 'Customer Support', priority: 'urgent' });
    expect(byCategory.get(EXECUTIVE_CATEGORIES.FAILED_INTEGRATIONS)).toMatchObject({ id: 'int1', department: 'Technology' });
    expect(byCategory.get(EXECUTIVE_CATEGORIES.SECURITY_INCIDENTS)).toMatchObject({ id: 's1', department: 'Compliance & Security', priority: 'urgent' });
  });

  it('excludes a pending expense below the high-value threshold', async () => {
    const supabase = makeSupabaseMock(
      { expenses: [{ id: 'e2', expense_number: 'EXP-2', description: 'Small purchase', amount: 10000, currency: 'TZS', status: 'pending_approval', created_at: '2026-01-01' }] },
      { company_settings: { expense_high_value_threshold: 500000 } }
    );
    const items = await getExecutiveActionItems(supabase);
    expect(items.filter((i) => i.category === EXECUTIVE_CATEGORIES.HIGH_VALUE_EXPENSES)).toHaveLength(0);
  });

  it('does not flag a paid, fully-settled invoice as overdue (application-level filter, not just the DB query)', async () => {
    // .in()/.eq() on the mock don't actually filter (they're no-ops that
    // just record the call) — this test is only meaningful for filters this
    // adapter itself applies in JS after the fetch, which is exactly the
    // case for invoices (queried with no status filter at all, then
    // filtered client-side by isOverdue).
    const supabase = makeSupabaseMock({
      invoices: [{ id: 'i2', invoice_number: 'INV-2', client_business_name: 'Acme', total: 100000, currency: 'TZS', status: 'paid', due_date: isoDaysAgo(10), outstanding_balance: 0, created_at: '2026-01-01' }],
    });
    const items = await getExecutiveActionItems(supabase);
    expect(items).toHaveLength(0);
  });
});
