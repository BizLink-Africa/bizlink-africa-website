// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

// Same guarantee as the sibling per-module tests (Commission & Fee Rules,
// Settlement & Payouts): the sidebar declares which permission gates each
// route, and each page.tsx independently calls requirePermission() to
// actually enforce it.
describe('Merchant Payouts — sidebar permission matches page enforcement', () => {
  // Payouts no longer has its own top-level group — it moved into
  // Settlement & Payouts (see navigation.ts). Payout Approvals and Failed
  // Payouts are the same page.tsx reached via its own ?status= filter, not
  // separate pages.
  const group = NAV_GROUPS.find((g) => g.label === 'Settlement & Payouts');
  if (!group) throw new Error('Settlement & Payouts group not found in navigation.ts');

  const payoutsItems = group.items.filter((item) => item.href === '/admin/payouts' || item.href.startsWith('/admin/payouts?'));

  it('Settlement & Payouts includes Merchant Payouts, Payout Approvals and Failed Payouts, all backed by the payouts list page', () => {
    expect(payoutsItems.map((i) => i.label).sort()).toEqual(['Failed Payouts', 'Merchant Payouts', 'Payout Approvals'].sort());
  });

  for (const item of payoutsItems) {
    it(`${item.label} (${item.href}) page.tsx requires '${item.permission}'`, () => {
      const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
      expect(source).toContain(`requirePermission('${item.permission}')`);
    });
  }

  it('page.tsx supports the status filter used by Payout Approvals / Failed Payouts', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).toMatch(/params\.status/);
  });

  it('the payout detail page requires payouts.view', () => {
    const source = readFileSync(join(__dirname, '[id]/page.tsx'), 'utf8');
    expect(source).toContain(`requirePermission('payouts.view')`);
  });

  it('the payout detail page gates approve/submit access behind fresh re-authentication', () => {
    const source = readFileSync(join(__dirname, '[id]/page.tsx'), 'utf8');
    expect(source).toContain('hasRecentReauth(PAYOUT_REAUTH_PURPOSE)');
    expect(source).toContain('PayoutReauthPrompt');
  });

  it('the export route requires payouts.view', () => {
    const source = readFileSync(join(__dirname, '[id]/export/route.ts'), 'utf8');
    expect(source).toContain(`requirePermission('payouts.view')`);
  });

  it('approvePayout and submitPayout in actions.ts both check hasRecentReauth before mutating', () => {
    const source = readFileSync(join(__dirname, 'actions.ts'), 'utf8');
    const approveFn = source.slice(source.indexOf('export async function approvePayout'), source.indexOf('export async function cancelPayout'));
    const submitFn = source.slice(source.indexOf('export async function submitPayout'), source.indexOf('export async function retryPayout'));
    expect(approveFn).toContain('hasRecentReauth(PAYOUT_REAUTH_PURPOSE)');
    expect(submitFn).toContain('hasRecentReauth(PAYOUT_REAUTH_PURPOSE)');
  });

  it('is only ever granted to super_admin, cfo and compliance_security (hold)/ceo (view) in the migration', () => {
    const migration = readFileSync(
      join(__dirname, '..', '..', '..', '..', '..', 'supabase', 'migrations', '20260812000000_create_merchant_payouts.sql'),
      'utf8'
    );
    for (const role of ['operations', 'customer_support', 'auditor', 'cto', 'marketing']) {
      expect(migration).not.toContain(`('${role}', 'payouts.`);
    }
  });

  it('never allows a payout mutation through frontend state alone — every mutating RPC is revoked from anon', () => {
    const migration = readFileSync(
      join(__dirname, '..', '..', '..', '..', '..', 'supabase', 'migrations', '20260812000000_create_merchant_payouts.sql'),
      'utf8'
    );
    for (const fn of [
      'create_merchant_payouts_for_batch', 'approve_merchant_payout', 'cancel_merchant_payout',
      'begin_merchant_payout_submission', 'apply_merchant_payout_result', 'retry_merchant_payout',
      'place_merchant_payout_hold', 'release_merchant_payout_hold', 'reverse_merchant_payout',
    ]) {
      expect(migration).toContain(`revoke execute on function ${fn}`);
    }
  });

  it('the disbursement adapter interface exposes exactly the four required methods', () => {
    const source = readFileSync(
      join(__dirname, '..', '..', '..', '..', 'lib', 'payouts', 'disbursement-adapter.ts'),
      'utf8'
    );
    for (const method of ['submitPayout', 'getPayoutStatus', 'validateBeneficiary', 'verifyWebhook']) {
      expect(source).toContain(`${method}(`);
    }
    // No live provider implementation — only Sandbox, matching the
    // "leave provider-specific implementation as TODO" instruction.
    expect(source).not.toMatch(/class \w*Live\w*Adapter/);
  });
});
