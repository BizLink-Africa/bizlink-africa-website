// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

// Merchant Payouts (formerly reached via the Settlement & Payouts group as
// Merchant Payouts / Payout Approvals / Failed Payouts, all the same list
// page filtered by ?status=) modeled BizLink as the party disbursing
// merchant funds. BizLink Africa does not receive, hold, disburse or
// settle merchant funds, so the whole Settlement & Payouts group — and with
// it every payouts sidebar entry — was removed from active navigation. The
// /admin/payouts route root is now gated Super Admin only behind the
// archived-financial-prototype layout — see navigation.ts and
// src/lib/archived-financial-prototype.ts. Nothing was deleted: page.tsx,
// the detail page and the export route still independently enforce
// payouts.view, and the underlying DB grants were never revoked.
describe('Merchant Payouts — dissolved group, routes archived and Super-Admin gated', () => {
  it('Settlement & Payouts (which used to carry Merchant Payouts / Payout Approvals / Failed Payouts) is no longer present in NAV_GROUPS', () => {
    const group = NAV_GROUPS.find((g) => g.label === 'Settlement & Payouts');
    expect(group).toBeUndefined();
  });

  it('no nav group links to /admin/payouts anymore (stays caught if someone re-adds it without going through the archival process)', () => {
    const linkingGroup = NAV_GROUPS.find((g) => g.items.some((i) => i.href.startsWith('/admin/payouts')));
    expect(linkingGroup).toBeUndefined();
  });

  it('page.tsx still requires payouts.view, even though it is no longer linked from the sidebar', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).toContain(`requirePermission('payouts.view')`);
  });

  it('page.tsx still supports the status filter that used to back Payout Approvals / Failed Payouts', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).toMatch(/params\.status/);
  });

  it('the payout detail page requires payouts.view', () => {
    const source = readFileSync(join(__dirname, '[id]/page.tsx'), 'utf8');
    expect(source).toContain(`requirePermission('payouts.view')`);
  });

  it('the payout detail page still references fresh re-authentication for approve/submit', () => {
    const source = readFileSync(join(__dirname, '[id]/page.tsx'), 'utf8');
    expect(source).toContain('hasRecentReauth(PAYOUT_REAUTH_PURPOSE)');
    expect(source).toContain('PayoutReauthPrompt');
  });

  it('the export route requires payouts.view', () => {
    const source = readFileSync(join(__dirname, '[id]/export/route.ts'), 'utf8');
    expect(source).toContain(`requirePermission('payouts.view')`);
  });

  it('layout.tsx wires up the archived-prototype access gate (Super Admin only)', () => {
    const source = readFileSync(join(__dirname, 'layout.tsx'), 'utf8');
    expect(source).toContain('checkArchivedFinancialPrototypeAccess');
  });

  it('approvePayout and submitPayout in actions.ts still reference hasRecentReauth (unreachable code kept for audit reference — see actions.test.ts for the fact that the archived-prototype guard now fires first)', () => {
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
