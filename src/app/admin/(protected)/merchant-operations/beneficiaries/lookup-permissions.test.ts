// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATION_PATH = join(__dirname, '..', '..', '..', '..', '..', '..', 'supabase', 'migrations', '20260818000000_selcom_account_lookup.sql');

// The exact, official code list confirmed against developer.selcom.business
// ("Destination Shortcodes") — see the migration's own header comment.
// Asserting the seed data is exactly this set (no more, no less) is a
// structural guard against a future edit accidentally inventing or
// silently dropping a code.
const OFFICIAL_BANK_CODES = [
  'ABSA', 'BANCABC', 'ACB', 'AMANA', 'AZANIA', 'BOA', 'BOBTZ', 'BOI', 'BOT', 'CANARA',
  'CITI', 'CRDB', 'DCB', 'DTB', 'ECOBANK', 'EQUITY', 'EXIM', 'FINCA', 'GTBANK', 'HABIB',
  'IMBANK', 'ICB', 'KCB', 'LETSHEGO', 'MAENDELEO', 'MKOMBOZI', 'MUCOBA', 'MWALIMU', 'MWANGA',
  'NBC', 'NCBA', 'NMB', 'PBZ', 'STANBIC', 'SCB', 'TCB', 'UCHUMI', 'UBA',
];
const OFFICIAL_WALLET_CODES = ['AIRTELMONEY', 'HALOPESA', 'MIXXBYYAS', 'TTCLPESA', 'MPESA'];
const OFFICIAL_INTERNAL_CODES = ['SELCOM'];

describe('Selcom institution codes — never invented, sourced only from the official doc list', () => {
  const migration = readFileSync(MIGRATION_PATH, 'utf8');
  const insertSection = migration.slice(
    migration.indexOf("insert into selcom_institution_codes"),
    migration.indexOf('on conflict (code) do nothing;')
  );

  const seededCodes = [...insertSection.matchAll(/\('([A-Z]+)',/g)].map((m) => m[1]);

  it('seeds exactly the official bank + wallet + internal codes, nothing extra', () => {
    const expected = [...OFFICIAL_INTERNAL_CODES, ...OFFICIAL_BANK_CODES, ...OFFICIAL_WALLET_CODES].sort();
    expect(seededCodes.sort()).toEqual(expected);
  });

  it('has no insert/update/delete policy — codes can only ever be added via a reviewed migration', () => {
    const tableSection = migration.slice(
      migration.indexOf('create table if not exists selcom_institution_codes'),
      migration.indexOf('insert into selcom_institution_codes')
    );
    expect(tableSection).not.toMatch(/for insert to authenticated/);
    expect(tableSection).not.toMatch(/for update to authenticated/);
    expect(tableSection).not.toMatch(/for delete to authenticated/);
  });
});

describe('lookup-actions.ts — permission, reauth, and no-raw-account guarantees', () => {
  const source = readFileSync(join(__dirname, 'lookup-actions.ts'), 'utf8');

  it('lookupBeneficiaryAccount requires merchant_beneficiaries.manage and fresh reauth', () => {
    const fn = source.slice(source.indexOf('export async function lookupBeneficiaryAccount'), source.indexOf('export async function confirmLookupNameMatch'));
    expect(fn).toContain(`requirePermission('merchant_beneficiaries.manage')`);
    expect(fn).toContain('hasRecentReauth()');
  });

  it('confirmLookupNameMatch requires merchant_beneficiaries.manage and fresh reauth', () => {
    const idx = source.indexOf('export async function confirmLookupNameMatch');
    const fn = source.slice(idx);
    expect(fn).toContain(`requirePermission('merchant_beneficiaries.manage')`);
    expect(fn).toContain('hasRecentReauth()');
  });

  it('generates the lookup reference/transId before calling Selcom, via the permission-checked wrapper RPC', () => {
    const generateIdx = source.indexOf('generate_selcom_lookup_reference');
    const lookupCallIdx = source.indexOf('lookupRecipientAccount(');
    expect(generateIdx).toBeGreaterThan(-1);
    expect(generateIdx).toBeLessThan(lookupCallIdx);
  });

  it('never includes the raw account number in a logAuditEvent call or in the action return value', () => {
    const auditCallStart = source.indexOf('await logAuditEvent({');
    const auditCallBlock = source.slice(auditCallStart, source.indexOf('});', auditCallStart));
    expect(auditCallBlock).not.toMatch(/\baccount\b\s*[,:]/);
    expect(auditCallBlock).not.toContain('input.account');

    const returnBlocks = [...source.matchAll(/return\s*\{[^}]*\}/g)].map((m) => m[0]);
    for (const block of returnBlocks) {
      expect(block).not.toContain('account,');
      expect(block).not.toContain('input.account');
    }
  });

  it('masks the account before it ever reaches the record_merchant_beneficiary_lookup RPC', () => {
    const rpcCallIdx = source.indexOf("supabase.rpc('record_merchant_beneficiary_lookup'");
    const rpcCallBlock = source.slice(rpcCallIdx, source.indexOf('});', rpcCallIdx));
    expect(rpcCallBlock).toContain('p_masked_account: maskedAccount');
    expect(rpcCallBlock).not.toContain('p_masked_account: account');
  });
});

describe('actions.ts — requestBeneficiaryChange links optional lookup evidence without changing maker-checker', () => {
  const source = readFileSync(join(__dirname, 'actions.ts'), 'utf8');

  it('passes lookupId through to p_lookup_id', () => {
    expect(source).toContain('p_lookup_id: input.lookupId ?? null');
  });

  it('still requires merchant_beneficiaries.manage to propose and .approve to approve — lookup evidence never grants either', () => {
    expect(source).toContain(`requirePermission('merchant_beneficiaries.manage')`);
    expect(source).toContain(`requirePermission('merchant_beneficiaries.approve')`);
  });
});

describe('Migration — payouts blocked when the beneficiary is not currently verified', () => {
  const migration = readFileSync(MIGRATION_PATH, 'utf8');

  it('approve_merchant_payout re-checks verification_status = verified', () => {
    const fn = migration.slice(
      migration.indexOf('create or replace function approve_merchant_payout'),
      migration.indexOf('create or replace function begin_merchant_payout_submission')
    );
    expect(fn).toContain("verification_status = 'verified'");
  });

  it('begin_merchant_payout_submission re-checks verification_status = verified independently', () => {
    const fn = migration.slice(migration.indexOf('create or replace function begin_merchant_payout_submission'));
    expect(fn).toContain("verification_status = 'verified'");
  });

  it('every new mutating RPC is revoked from anon', () => {
    for (const fn of [
      'generate_selcom_lookup_reference()',
      'record_merchant_beneficiary_lookup(text, uuid, uuid, text, text, text, jsonb, numeric, text, text)',
      'confirm_beneficiary_lookup_name_match(uuid, boolean, text)',
    ]) {
      expect(migration).toContain(`revoke execute on function ${fn} from anon`);
    }
  });

  it('merchant_beneficiary_lookups has no insert/update policy — only the two RPCs above can write to it', () => {
    const tableSection = migration.slice(
      migration.indexOf('create table if not exists merchant_beneficiary_lookups'),
      migration.indexOf('create index if not exists merchant_beneficiary_lookups_merchant_id_idx')
    );
    expect(tableSection).not.toMatch(/for insert to authenticated/);
    expect(tableSection).not.toMatch(/for update to authenticated/);
  });

  it('a lookup alone never sets verification_status — that column is only ever touched by approve_merchant_beneficiary_change_request', () => {
    const lookupFnsSection = migration.slice(
      migration.indexOf('create or replace function generate_selcom_lookup_reference'),
      migration.indexOf('create or replace function request_merchant_beneficiary_change')
    );
    expect(lookupFnsSection).not.toContain('verification_status');
  });
});
