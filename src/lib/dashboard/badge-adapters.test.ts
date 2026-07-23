// @vitest-environment node
//
// badge-adapters.ts imports 'server-only', which throws as soon as it
// detects a `window` global — jsdom defines one, Node doesn't. This file has
// no DOM to test against anyway, so it runs under the plain node environment.
import { describe, expect, it } from 'vitest';
import { getSidebarBadgeCounts } from './badge-adapters';

// Query-builder mock: `.select/.eq/.in/.lt/.gt` chain in any order, then the
// builder itself is awaited (Supabase's real builder is thenable). Each call
// records which column/value filters were applied so a single mocked
// `.from('contracts')` can still tell its two different call sites (pending
// CEO approval vs. operational contract stages) apart — that distinction is
// exactly what the badge counts depend on being correct.
function makeSupabaseMock(
  resolveFor: (table: string, filters: string[]) => { count: number | null; error: { message: string } | null }
) {
  function builder(table: string, filters: string[] = []) {
    const api = {
      select: () => builder(table, filters),
      eq: (col: string, val: string) => builder(table, [...filters, `${col}=${val}`]),
      neq: (col: string, val: string) => builder(table, [...filters, `${col}!=${val}`]),
      in: (col: string, vals: string[]) => builder(table, [...filters, `${col} in ${vals.join(',')}`]),
      lt: (col: string, val: string) => builder(table, [...filters, `${col}<${val}`]),
      gt: (col: string, val: string) => builder(table, [...filters, `${col}>${val}`]),
      then: (resolve: (value: ReturnType<typeof resolveFor>) => void) => resolve(resolveFor(table, filters)),
    };
    return api;
  }

  return {
    from: (table: string) => builder(table),
  } as never;
}

function makeCountingSupabaseMock(countFor: (table: string, filters: string[]) => number) {
  return makeSupabaseMock((table, filters) => ({ count: countFor(table, filters), error: null }));
}

describe('getSidebarBadgeCounts', () => {
  it('maps each real query to its own badge key, without hardcoding values', async () => {
    // Every count below is distinct so a mixed-up mapping in the adapter
    // (e.g. pendingContracts reading pendingApprovals' count) would fail
    // the assertions further down instead of passing by coincidence.
    const supabase = makeCountingSupabaseMock((table, filters) => {
      switch (table) {
        case 'website_leads':
          return filters.some((f) => f.startsWith('notification_status=')) ? 9 : 2;
        case 'support_tickets':
          return 1;
        case 'integration_health':
          return 4;
        case 'invoices':
          return 5;
        case 'contracts':
          return filters.some((f) => f.includes('pending_ceo_approval')) ? 3 : 6;
        case 'security_events':
          return 7;
        case 'compliance_reviews':
          return 8;
        case 'webhook_deliveries':
          return 10;
        case 'background_jobs':
          return 11;
        case 'technical_incidents':
          return 12;
        case 'approval_requests':
          return 13;
        default:
          return 0;
      }
    });

    const result = await getSidebarBadgeCounts(supabase);

    expect(result.criticalTickets).toBe(1);
    expect(result.failedIntegrations).toBe(4);
    expect(result.overdueInvoices).toBe(5);
    expect(result.pendingApprovals).toBe(3);
    expect(result.pendingContracts).toBe(6);
    expect(result.openSecurityEvents).toBe(7);
    expect(result.pendingComplianceReviews).toBe(8);
    expect(result.failedNotifications).toBe(9);
    expect(result.failedWebhooks).toBe(10);
    expect(result.failedJobs).toBe(11);
    expect(result.activeIncidents).toBe(12);
    expect(result.pendingApprovalWorkflowActions).toBe(13);
    // actionQueue is the one deliberately-composed key: delayed onboarding (2)
    // + critical tickets (1) + failed integrations (4).
    expect(result.actionQueue).toBe(2 + 1 + 4);
  });

  it('degrades every count to 0 rather than throwing when a table errors (e.g. pre-migration)', async () => {
    const supabase = makeSupabaseMock(() => ({ count: null, error: { message: 'relation does not exist' } }));

    const result = await getSidebarBadgeCounts(supabase);
    for (const value of Object.values(result)) {
      expect(value).toBe(0);
    }
  });
});
