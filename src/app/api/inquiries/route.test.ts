// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MERCHANT_SOLUTION_VALUE } from '@/data/inquiries';

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: fromMock }),
}));

vi.mock('@/lib/email/resend', () => ({
  sendInquiryNotificationEmail: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/lib/posthog-server', () => ({
  getPostHogClient: () => null,
}));

const { POST, OPTIONS } = await import('./route');

beforeEach(() => {
  vi.clearAllMocks();
});

function postRequest(origin: string | null, body: unknown = {}): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (origin) headers.origin = origin;
  return new Request('https://bizlinkafrica.net/api/inquiries', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// A generic chainable query-builder stand-in: every chain method returns
// itself, and awaiting the chain at any point (this route sometimes awaits
// mid-chain, sometimes after an explicit .single()/.maybeSingle()) resolves
// to the same result shape. Good enough to drive execution safely past the
// CORS check being tested here — not a faithful Supabase mock, and not
// meant to exercise the rest of the route's business logic.
function makeQueryBuilder(result: Record<string, unknown> = { data: null, error: null, count: 0 }) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    insert: () => builder,
    update: () => builder,
    limit: () => builder,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

describe('POST /api/inquiries — CORS/origin allow-list', () => {
  it('rejects a cross-origin request from an unrecognized Origin before touching Supabase', async () => {
    const response = await POST(postRequest('https://attacker.example'));
    expect(response.status).toBe(403);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('does not reject a request with no Origin header (same-origin browser requests often omit it)', async () => {
    fromMock.mockReturnValue(makeQueryBuilder());
    const response = await POST(postRequest(null));
    // Falls through past the origin check into normal validation (400 for
    // an empty/invalid body here) rather than the 403 origin-rejection path.
    expect(response.status).not.toBe(403);
  });

  it('does not reject an allowed public-site Origin', async () => {
    fromMock.mockReturnValue(makeQueryBuilder());
    const response = await POST(postRequest('https://bizlinkafrica.net'));
    expect(response.status).not.toBe(403);
  });
});

// A per-table-aware Supabase mock that records insert/update payloads, so
// tests can assert exactly what gets persisted for each inquiry type.
function makeSupabaseMock({
  rateLimitCount = 0,
  duplicate = null,
  insertResult = { data: { id: 'lead-1', created_at: '2026-08-04T10:00:00.000Z' }, error: null as unknown },
}: {
  rateLimitCount?: number;
  duplicate?: unknown;
  insertResult?: { data: unknown; error: unknown };
} = {}) {
  const insertCalls: { table: string; payload: unknown }[] = [];
  const updateCalls: { table: string; payload: unknown }[] = [];

  function builder(table: string) {
    const api: Record<string, unknown> = {
      select: () => api,
      eq: () => api,
      gte: () => api,
      limit: () => api,
      insert: (payload: unknown) => {
        insertCalls.push({ table, payload });
        return api;
      },
      update: (payload: unknown) => {
        updateCalls.push({ table, payload });
        return api;
      },
      maybeSingle: () => Promise.resolve({ data: duplicate, error: null }),
      single: () => Promise.resolve(insertResult),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(
          table === 'inquiry_submission_log' ? { count: rateLimitCount, data: null, error: null } : { data: null, error: null }
        ).then(resolve),
    };
    return api;
  }

  return { from: (table: string) => builder(table), insertCalls, updateCalls };
}

const baseIctInquiry = {
  fullName: 'Amina Juma',
  businessName: 'Amina Textiles',
  businessType: 'Retail',
  location: 'Kariakoo, Dar es Salaam',
  phone: '+255700000000',
  email: 'amina@example.com',
  requestedSolution: ['ai_sales_agent'],
  consentGiven: true,
};

const baseMerchantInquiry = {
  fullName: 'Juma Mwakasege',
  businessName: 'Mwakasege Traders',
  businessType: 'Retail shop',
  location: 'Mwanza',
  phone: '+255711111111',
  email: 'juma@example.com',
  requestedSolution: [MERCHANT_SOLUTION_VALUE],
  consentGiven: true,
  merchantBusinessRegistrationStatus: 'registered',
  merchantBusinessType: 'retail',
  merchantMonthlyVolumeRange: '5m_20m',
  merchantCurrentCollectionMethod: 'mobile_money_manual',
  merchantBusinessLocationsCount: 2,
  merchantGoLiveTimeline: 'within_1_month',
  merchantAccuracyConfirmed: true,
};

describe('POST /api/inquiries — saves inquiries correctly', () => {
  it('saves a normal ICT inquiry with no merchant fields set', async () => {
    const mock = makeSupabaseMock();
    fromMock.mockImplementation(mock.from);

    const response = await POST(postRequest('https://bizlinkafrica.net', baseIctInquiry));
    const json = await response.json();

    expect(json.success).toBe(true);
    const leadInsert = mock.insertCalls.find((c) => c.table === 'website_leads');
    expect(leadInsert?.payload).toMatchObject({
      full_name: 'Amina Juma',
      business_name: 'Amina Textiles',
      email: 'amina@example.com',
      requested_solution: ['ai_sales_agent'],
      merchant_accuracy_confirmed: false,
      merchant_business_registration_status: null,
      merchant_business_type: null,
      merchant_business_locations_count: null,
    });
  });

  it('saves a merchant payment-infrastructure inquiry with all preliminary fields', async () => {
    const mock = makeSupabaseMock();
    fromMock.mockImplementation(mock.from);

    const response = await POST(postRequest('https://bizlinkafrica.net', baseMerchantInquiry));
    const json = await response.json();

    expect(json.success).toBe(true);
    const leadInsert = mock.insertCalls.find((c) => c.table === 'website_leads');
    expect(leadInsert?.payload).toMatchObject({
      full_name: 'Juma Mwakasege',
      requested_solution: [MERCHANT_SOLUTION_VALUE],
      merchant_business_registration_status: 'registered',
      merchant_business_type: 'retail',
      merchant_monthly_volume_range: '5m_20m',
      merchant_current_collection_method: 'mobile_money_manual',
      merchant_business_locations_count: 2,
      merchant_golive_timeline: 'within_1_month',
      merchant_accuracy_confirmed: true,
    });
    // Never persists any bank/wallet account number or KYC document field —
    // those don't exist as accepted inputs on this route at all.
    expect(leadInsert?.payload).not.toHaveProperty('bank_account_number');
    expect(leadInsert?.payload).not.toHaveProperty('mobile_wallet_number');
  });

  it('rejects a merchant application missing the required preliminary fields', async () => {
    const mock = makeSupabaseMock();
    fromMock.mockImplementation(mock.from);

    const incomplete = {
      ...baseMerchantInquiry,
      merchantBusinessRegistrationStatus: undefined,
      merchantAccuracyConfirmed: undefined,
    };
    const response = await POST(postRequest('https://bizlinkafrica.net', incomplete));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(mock.insertCalls.find((c) => c.table === 'website_leads')).toBeUndefined();
  });

  it('rejects the general consent checkbox being unchecked', async () => {
    const mock = makeSupabaseMock();
    fromMock.mockImplementation(mock.from);

    const response = await POST(postRequest('https://bizlinkafrica.net', { ...baseIctInquiry, consentGiven: false }));
    expect(response.status).toBe(400);
    expect(mock.insertCalls.find((c) => c.table === 'website_leads')).toBeUndefined();
  });

  it('rate-limits after the configured number of submissions from one IP', async () => {
    const mock = makeSupabaseMock({ rateLimitCount: 5 });
    fromMock.mockImplementation(mock.from);

    const response = await POST(postRequest('https://bizlinkafrica.net', baseIctInquiry));
    expect(response.status).toBe(429);
    expect(mock.insertCalls.find((c) => c.table === 'website_leads')).toBeUndefined();
  });

  it('silently drops honeypot-triggered submissions without saving or erroring', async () => {
    const mock = makeSupabaseMock();
    fromMock.mockImplementation(mock.from);

    const response = await POST(
      postRequest('https://bizlinkafrica.net', { ...baseIctInquiry, website: 'http://spam.example' })
    );
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(mock.insertCalls.find((c) => c.table === 'website_leads')).toBeUndefined();
  });

  it('treats a rapid duplicate submission as already received without a second insert', async () => {
    const mock = makeSupabaseMock({ duplicate: { id: 'existing-lead' } });
    fromMock.mockImplementation(mock.from);

    const response = await POST(postRequest('https://bizlinkafrica.net', baseIctInquiry));
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(mock.insertCalls.find((c) => c.table === 'website_leads')).toBeUndefined();
  });
});

describe('OPTIONS /api/inquiries — CORS preflight', () => {
  it('echoes back an allowed origin', async () => {
    const request = new Request('https://bizlinkafrica.net/api/inquiries', {
      method: 'OPTIONS',
      headers: { origin: 'https://www.bizlinkafrica.net' },
    });
    const response = await OPTIONS(request);
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://www.bizlinkafrica.net');
  });

  it('never echoes back an arbitrary/disallowed origin', async () => {
    const request = new Request('https://bizlinkafrica.net/api/inquiries', {
      method: 'OPTIONS',
      headers: { origin: 'https://attacker.example' },
    });
    const response = await OPTIONS(request);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
