// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

const ACTIONS_PATH = join(__dirname, '..', 'production-readiness-actions.ts');

describe('Production Readiness — sidebar permission matches page enforcement', () => {
  const group = NAV_GROUPS.find((g) => g.label === 'Administration');
  if (!group) throw new Error('Administration group not found in navigation.ts');

  const item = group.items.find((i) => i.href === '/admin/settings/integrations/selcom/production-readiness');

  it('Administration includes the Production Readiness item gated by selcom_production.view', () => {
    expect(item).toBeDefined();
    expect(item?.permission).toBe('selcom_production.view');
  });

  it('page.tsx requires selcom_production.view', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).toContain(`requirePermission('selcom_production.view')`);
  });

  it('page.tsx separately checks manage_checklist/approve_finance/approve_compliance/authorize for conditional rendering', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).toContain("'selcom_production.manage_checklist'");
    expect(source).toContain("'selcom_production.approve_finance'");
    expect(source).toContain("'selcom_production.approve_compliance'");
    expect(source).toContain("'selcom_production.authorize'");
  });

  it('page.tsx gates approval/authorization sections behind fresh SELCOM_INTEGRATION_REAUTH_PURPOSE re-authentication', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).toContain('hasRecentReauth(SELCOM_INTEGRATION_REAUTH_PURPOSE)');
    expect(source).toContain('SelcomReauthPrompt');
  });

  it('page.tsx shows a clear LIVE badge via SelcomEnvironmentBadge', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).toContain('SelcomEnvironmentBadge');
  });

  it('page.tsx never claims authorization makes production live by itself', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).toMatch(/makes production live by itself/i);
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
