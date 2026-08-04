// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

const ACTIONS_PATH = join(__dirname, '..', 'production-readiness-actions.ts');

// "Disbursement API: Production Readiness" modeled the checklist for
// putting BizLink's own Selcom disbursement account live in production.
// BizLink Africa does not receive, hold, disburse or settle merchant funds
// and has no disbursement account to activate for production, so this item
// was removed from the Administration group in the sidebar — see
// navigation.ts and src/lib/archived-financial-prototype.ts. Nothing was
// deleted: page.tsx and production-readiness-actions.ts still independently
// enforce their original permissions/reauth/reason checks.
describe('Production Readiness — dissolved sidebar item, route archived and Super-Admin gated', () => {
  const group = NAV_GROUPS.find((g) => g.label === 'Administration');
  if (!group) throw new Error('Administration group not found in navigation.ts');

  it('Administration no longer includes the Production Readiness item (stays caught if someone re-adds it without going through the archival process)', () => {
    const item = group.items.find((i) => i.href === '/admin/settings/integrations/selcom/production-readiness');
    expect(item).toBeUndefined();
  });

  it('no item in Administration mentions "Production Readiness" at all', () => {
    const item = group.items.find((i) => i.label.includes('Production Readiness'));
    expect(item).toBeUndefined();
  });

  it('page.tsx still requires selcom_production.view, even though it is no longer linked from the sidebar', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).toContain(`requirePermission('selcom_production.view')`);
  });

  it("the shared selcom layout.tsx (parent of production-readiness/) wires up the archived-prototype access gate", () => {
    const source = readFileSync(join(__dirname, '..', 'layout.tsx'), 'utf8');
    expect(source).toContain('checkArchivedFinancialPrototypeAccess');
  });

  // The operating model changed before live payout activation (see
  // docs/SELCOM_PRODUCTION_READINESS_REPORT.md's "Disbursement Integration
  // Retired" section). This page is now a permanently read-only historical
  // record: canManageChecklist/canApproveFinance/canApproveCompliance/
  // canAuthorize are hardcoded false rather than computed from the
  // caller's actual permissions, so every viewer — including Super Admin —
  // sees a pure display-only view. No re-authentication is requested to
  // view an archived record with nothing left to authorize.
  it('page.tsx hardcodes every manage/approve/authorize flag to false rather than computing it from the caller\'s permissions — no further checklist items, approvals, or authorizations can be recorded', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).toContain('const canManageChecklist = false;');
    expect(source).toContain('const canApproveFinance = false;');
    expect(source).toContain('const canApproveCompliance = false;');
    expect(source).toContain('const canAuthorize = false;');
    expect(source).not.toContain("requirePermission('selcom_production.manage_checklist')");
    expect(source).not.toContain("requirePermission('selcom_production.approve_finance')");
    expect(source).not.toContain("requirePermission('selcom_production.approve_compliance')");
    expect(source).not.toContain("requirePermission('selcom_production.authorize')");
  });

  it('page.tsx displays the exact required archived label', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).toContain('Archived — operating model changed before live payout activation.');
  });

  it('page.tsx no longer gates viewing behind re-authentication — there is nothing left to authorize', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).not.toContain('hasRecentReauth');
    expect(source).not.toContain('SelcomReauthPrompt');
  });

  it('page.tsx shows a clear LIVE badge via SelcomEnvironmentBadge', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).toContain('SelcomEnvironmentBadge');
  });

  it('page.tsx states this workflow will not resume, stronger than the old "not by itself" caveat now that it is archived', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).toMatch(/will not resume/i);
  });
});

describe('production-readiness-actions.ts — permission + reauth + reason enforcement', () => {
  const source = readFileSync(ACTIONS_PATH, 'utf8');

  function slice(fnName: string, nextFnName: string): string {
    return source.slice(source.indexOf(`export async function ${fnName}`), source.indexOf(`export async function ${nextFnName}`));
  }

  it('setProductionReadinessCheck requires selcom_production.manage_checklist, validates the item key, but does NOT require reauth (routine QA attestation work)', () => {
    const fn = source.slice(source.indexOf('export async function setProductionReadinessCheck'), source.indexOf('async function recordApproval'));
    expect(fn).toContain(`requirePermission('selcom_production.manage_checklist')`);
    expect(fn).toContain('PRODUCTION_READINESS_ITEM_KEYS.includes(itemKey)');
    expect(fn).not.toContain('hasRecentReauth');
  });

  it('recordFinanceApproval and recordComplianceApproval both funnel through the same recordApproval() helper, requiring reauth and a reason', () => {
    const helperIdx = source.indexOf('async function recordApproval');
    const helperBody = source.slice(helperIdx, source.indexOf('export async function recordFinanceApproval'));
    expect(helperBody).toContain('hasRecentReauth(SELCOM_INTEGRATION_REAUTH_PURPOSE)');
    expect(helperBody).toContain('if (!reason || !reason.trim())');
    expect(helperBody).toMatch(/selcom_production\.approve_finance[\s\S]*selcom_production\.approve_compliance|permission = kind === 'finance'/);
  });

  it('authorizeProductionActivation requires selcom_production.authorize, fresh reauth, and a non-empty reason', () => {
    const fn = slice('authorizeProductionActivation', 'deauthorizeProductionActivation');
    expect(fn).toContain(`requirePermission('selcom_production.authorize')`);
    expect(fn).toContain('hasRecentReauth(SELCOM_INTEGRATION_REAUTH_PURPOSE)');
    expect(fn).toContain('if (!reason || !reason.trim())');
  });

  it('authorizeProductionActivation never itself sets SELCOM_ENV or calls a live Selcom endpoint', () => {
    const fn = slice('authorizeProductionActivation', 'deauthorizeProductionActivation');
    expect(fn).not.toMatch(/process\.env\.SELCOM_ENV\s*=/);
    expect(fn).not.toMatch(/getSelcomConfig|selcomRequest/);
  });

  it('deauthorizeProductionActivation requires the same permission as authorizing, fresh reauth, and a non-empty reason', () => {
    const fn = source.slice(source.indexOf('export async function deauthorizeProductionActivation'));
    expect(fn).toContain(`requirePermission('selcom_production.authorize')`);
    expect(fn).toContain('hasRecentReauth(SELCOM_INTEGRATION_REAUTH_PURPOSE)');
    expect(fn).toContain('if (!reason || !reason.trim())');
  });

  it('every mutation in this file is audit-logged under module selcom_integration', () => {
    // setProductionReadinessCheck, the shared recordApproval() helper
    // (covers both finance and compliance), authorizeProductionActivation,
    // and deauthorizeProductionActivation — 4 distinct audit call sites.
    const matches = source.match(/module: 'selcom_integration'/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });
});
