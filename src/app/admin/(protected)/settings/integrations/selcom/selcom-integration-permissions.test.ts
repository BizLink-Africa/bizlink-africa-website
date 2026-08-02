// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

const MIGRATION_PATH = join(
  __dirname, '..', '..', '..', '..', '..', '..', '..',
  'supabase', 'migrations', '20260817000000_create_selcom_integration_settings.sql'
);

describe('Selcom Disbursement API integration — sidebar permission matches page enforcement', () => {
  const group = NAV_GROUPS.find((g) => g.label === 'Administration');
  if (!group) throw new Error('Administration group not found in navigation.ts');

  const item = group.items.find((i) => i.href === '/admin/settings/integrations/selcom');

  it('Administration includes a Disbursement API item gated by integrations.selcom.view', () => {
    expect(item).toBeDefined();
    expect(item?.permission).toBe('integrations.selcom.view');
  });

  it('page.tsx requires integrations.selcom.view', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).toContain(`requirePermission('integrations.selcom.view')`);
  });

  it('page.tsx separately checks manage/test/balance permissions for conditional rendering', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).toContain("'integrations.selcom.manage'");
    expect(source).toContain("'integrations.selcom.test'");
    expect(source).toContain("'integrations.selcom.balance'");
  });

  // The Finance-facing balance dashboard (disbursement_balance.view, which
  // includes finance_approver — who has no reason to see credential/
  // callback configuration at all) is a SEPARATE page, not a broadened
  // gate on this one — see settlement/balance/page.tsx and its own
  // permission test in settlement-permissions.test.ts. This keeps this
  // page's "one permission, one page" invariant intact, same as every
  // other Administration route (see administration-permissions.test.ts).
  it('page.tsx links to the separate Disbursement Balance page rather than embedding it', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).toContain('/admin/settlement/balance');
  });
});

describe('Selcom Disbursement API integration — actions.ts permission + reauth enforcement', () => {
  const source = readFileSync(join(__dirname, 'actions.ts'), 'utf8');

  function slice(fnName: string, nextFnName: string): string {
    return source.slice(source.indexOf(`export async function ${fnName}`), source.indexOf(`export async function ${nextFnName}`));
  }

  it('setIntegrationEnabled requires integrations.selcom.manage and fresh reauth', () => {
    const fn = slice('setIntegrationEnabled', 'requestProductionActivation');
    expect(fn).toContain(`requirePermission('integrations.selcom.manage')`);
    expect(fn).toContain('hasRecentReauth(SELCOM_INTEGRATION_REAUTH_PURPOSE)');
  });

  it('requestProductionActivation requires integrations.selcom.manage and fresh reauth, and never flips config to production', () => {
    const fn = slice('requestProductionActivation', 'testSandboxConnection');
    expect(fn).toContain(`requirePermission('integrations.selcom.manage')`);
    expect(fn).toContain('hasRecentReauth(SELCOM_INTEGRATION_REAUTH_PURPOSE)');
    expect(fn).not.toMatch(/SELCOM_ENV\s*=/);
    expect(fn).not.toContain('process.env.SELCOM_ENV =');
  });

  it('testSandboxConnection requires integrations.selcom.test and refuses to run while disabled', () => {
    const fn = slice('testSandboxConnection', 'checkAccountBalance');
    expect(fn).toContain(`requirePermission('integrations.selcom.test')`);
    expect(fn).toContain('assertIntegrationEnabled');
  });

  it('checkAccountBalance requires integrations.selcom.balance and refuses to run while disabled', () => {
    const fn = slice('checkAccountBalance', 'verifyCallbackConfiguration');
    expect(fn).toContain(`requirePermission('integrations.selcom.balance')`);
    expect(fn).toContain('assertIntegrationEnabled');
  });

  it('verifyCallbackConfiguration requires integrations.selcom.test and never claims to have called Selcom', () => {
    const idx = source.indexOf('export async function verifyCallbackConfiguration');
    const fn = source.slice(idx);
    expect(fn).toContain(`requirePermission('integrations.selcom.test')`);
    expect(fn).toMatch(/does not confirm Selcom/i);
  });

  it('never references a raw Selcom secret env var directly — only masked status from lib/selcom/status', () => {
    for (const rawVar of ['process.env.SELCOM_API_KEY', 'process.env.SELCOM_RSA_PRIVATE_KEY', 'process.env.SELCOM_CALLBACK_SECRET']) {
      expect(source).not.toContain(rawVar);
    }
  });

  it('every audit log entry uses module selcom_integration', () => {
    const matches = source.match(/module: 'selcom_integration'/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(5);
  });

  it('simulateSelcomCallback requires integrations.selcom.test, refuses to run while disabled, and requires fresh payout reauth before a live send', () => {
    const fn = source.slice(source.indexOf('export async function simulateSelcomCallback'));
    expect(fn).toContain(`requirePermission('integrations.selcom.test')`);
    expect(fn).toContain('assertIntegrationEnabled');
    expect(fn).toContain('hasRecentReauth(PAYOUT_REAUTH_PURPOSE)');
    expect(fn).toContain('!options.dryRun');
  });

  it('simulateSelcomCallback never creates a request payload with a genuine raw destination account number — the happy path omits recipient_account_number entirely', () => {
    const fn = source.slice(
      source.indexOf('export async function simulateSelcomCallback'),
      source.indexOf('export async function simulateSelcomCallback') + source.slice(source.indexOf('export async function simulateSelcomCallback')).length
    );
    expect(fn).toContain('recipientAccountNumber ?');
    expect(fn).not.toMatch(/decrypt/i);
  });

  it('refreshDisbursementBalance requires disbursement_balance.refresh (narrower than view) and refuses to run while disabled', () => {
    const fn = source.slice(source.indexOf('export async function refreshDisbursementBalance'));
    expect(fn).toContain(`requirePermission('disbursement_balance.refresh')`);
    expect(fn).toContain('assertIntegrationEnabled');
  });

  it('refreshDisbursementBalance never returns the raw Selcom response — only the masked/typed fields refreshSelcomBalance() produces', () => {
    const fn = source.slice(source.indexOf('export async function refreshDisbursementBalance'));
    expect(fn).not.toMatch(/result\.data\b/);
    expect(fn).toContain('maskedAccountNumber');
  });
});

describe('Selcom Disbursement API integration — status.ts never exposes a raw secret', () => {
  const source = readFileSync(join(__dirname, '..', '..', '..', '..', '..', '..', 'lib', 'selcom', 'status.ts'), 'utf8');
  // The actual snapshot object getSelcomIntegrationStatus() hands back to
  // callers — isolated from the internal helper functions above it (which
  // legitimately read raw process.env values in order to compute masked/
  // derived fields; the property being tested is about what's RETURNED to
  // callers, not what's read internally).
  const snapshotReturn = source.slice(
    source.indexOf('export function getSelcomIntegrationStatus'),
    source.lastIndexOf('}')
  );

  it('imports and uses maskCredential rather than returning raw env values', () => {
    expect(source).toContain("maskCredential");
    expect(snapshotReturn).not.toMatch(/return\s*{\s*[\s\S]*?process\.env\.SELCOM_API_KEY[\s\S]*?}/);
  });

  it('the final snapshot return statement never embeds a raw process.env.SELCOM_* read directly as a field value (sandbox or production)', () => {
    const finalReturn = snapshotReturn.slice(snapshotReturn.lastIndexOf('return {'));
    expect(finalReturn).not.toMatch(/process\.env\.SELCOM/);
  });

  it('exposes only masked fields for the API key and disbursement account (sandbox and production)', () => {
    expect(source).toContain('maskedApiKey');
    expect(source).toContain('maskedDisbursementAccount');
    expect(source).toContain('maskedProductionApiKey');
    expect(source).toContain('maskedProductionDisbursementAccount');
    expect(source).not.toMatch(/\brawApiKey\b/);
    expect(source).not.toMatch(/\brawPrivateKey\b/);
  });
});

describe('Selcom Disbursement API integration — migration grants and RPC lockdown', () => {
  const migration = readFileSync(MIGRATION_PATH, 'utf8');

  it('is only ever granted to super_admin, cto, cfo, ceo — never support/marketing/operations/compliance_security', () => {
    for (const role of ['customer_support', 'marketing', 'operations', 'compliance_security']) {
      expect(migration).not.toContain(`('${role}', 'integrations.selcom.`);
    }
  });

  it('grants manage only broadly to super_admin, not to cto/cfo/ceo', () => {
    for (const role of ['cto', 'cfo', 'ceo']) {
      expect(migration).not.toContain(`('${role}', 'integrations.selcom.manage')`);
    }
  });

  it('grants test only to cto (Technical Admin), never cfo', () => {
    expect(migration).toContain(`('cto', 'integrations.selcom.test')`);
    expect(migration).not.toContain(`('cfo', 'integrations.selcom.test')`);
  });

  it('grants balance visibility to both cto and cfo (Finance)', () => {
    expect(migration).toContain(`('cto', 'integrations.selcom.balance')`);
    expect(migration).toContain(`('cfo', 'integrations.selcom.balance')`);
  });

  it('every mutating RPC is revoked from anon', () => {
    for (const fn of [
      'set_selcom_integration_enabled(boolean)',
      'request_selcom_production_activation(text)',
      'sync_selcom_configuration_snapshot(text, text, text, boolean)',
    ]) {
      expect(migration).toContain(`revoke execute on function ${fn} from anon`);
    }
  });

  it('has no direct insert/update RLS policy on selcom_integration_settings — only SELECT', () => {
    const tableSection = migration.slice(
      migration.indexOf('create table if not exists selcom_integration_settings'),
      migration.indexOf('-- ── Permissions')
    );
    expect(tableSection).toContain('for select to authenticated');
    expect(tableSection).not.toMatch(/for insert to authenticated/);
    expect(tableSection).not.toMatch(/for update to authenticated/);
  });

  it('production activation requires a prior successful sandbox connection test', () => {
    expect(migration).toMatch(/connection_test[\s\S]*?result = 'success'/);
  });

  it('the settings table holds no credential material — unlike merchant_settlement_beneficiaries, no bytea/encrypted column exists here at all', () => {
    const tableSection = migration.slice(
      migration.indexOf('create table if not exists selcom_integration_settings'),
      migration.indexOf('insert into selcom_integration_settings')
    );
    expect(tableSection).not.toMatch(/\bbytea\b/);
    expect(tableSection.toLowerCase()).not.toContain('encrypted');
    // The only "api_key"/"account" references allowed are the two
    // non-reversible masked-fingerprint columns used purely for drift
    // detection (see the migration's own comment on last_observed_*).
    expect(tableSection).toContain('last_observed_api_key_fingerprint');
    expect(tableSection).toContain('last_observed_disbursement_account_fingerprint');
  });
});
