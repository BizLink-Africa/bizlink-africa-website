// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(join(__dirname, '20260821000000_selcom_callback_endpoint.sql'), 'utf8');

function fnBody(): string {
  return migration.slice(
    migration.indexOf('create or replace function process_selcom_callback'),
    migration.indexOf('revoke execute on function process_selcom_callback')
  );
}

describe('process_selcom_callback — row locking, permissions, and guards', () => {
  it('locks the payout row with FOR UPDATE before evaluating any guard', () => {
    expect(fnBody()).toContain('for update');
  });

  it('is callable by an authenticated staff member with payouts.submit or by the service-role callback route', () => {
    expect(fnBody()).toContain("has_permission('payouts.submit') or auth.role() = 'service_role'");
  });

  it('is revoked from public/anon and only granted to authenticated', () => {
    expect(migration).toContain(
      'revoke execute on function process_selcom_callback(text, text, text, text, text, text, text, text, jsonb, text, text, boolean) from public'
    );
    expect(migration).toContain(
      'grant execute on function process_selcom_callback(text, text, text, text, text, text, text, text, jsonb, text, text, boolean) to authenticated'
    );
    expect(migration).toContain(
      'revoke execute on function process_selcom_callback(text, text, text, text, text, text, text, text, jsonb, text, text, boolean) from anon'
    );
  });

  it('never inserts into merchant_payouts — only ever updates an existing row found by reference_id', () => {
    const body = fnBody();
    expect(body).not.toMatch(/insert into merchant_payouts\b/);
    expect(body).toContain('update merchant_payouts set');
    expect(body).toContain('select * into v_payout from merchant_payouts where payout_reference = p_reference_id');
  });

  it('rejects anything other than a documented SUCCESS status before even looking the payout up', () => {
    const body = fnBody();
    const statusCheckIdx = body.indexOf("p_raw_status is distinct from 'SUCCESS'");
    const payoutLookupIdx = body.indexOf('select * into v_payout');
    expect(statusCheckIdx).toBeGreaterThan(-1);
    expect(payoutLookupIdx).toBeGreaterThan(statusCheckIdx);
  });

  it('treats an unresolved reference_id as a distinct outcome from every other rejection', () => {
    expect(fnBody()).toContain("v_outcome := 'reference_not_found';");
  });

  it('detects a duplicate/replayed callback via the payout already being successful, not a separate lookup table scan', () => {
    expect(fnBody()).toContain("v_payout.status = 'successful' then");
    expect(fnBody()).toContain("v_outcome := 'duplicate';");
  });

  it('treats a callback for a payout already resolved to a DIFFERENT terminal state as a distinct anomaly from a duplicate', () => {
    expect(fnBody()).toContain("v_payout.status in ('failed', 'reversed', 'cancelled', 'manual_review')");
  });

  it('only accepts a callback for a payout that has actually been submitted (submitted/processing/unknown)', () => {
    expect(fnBody()).toContain("v_payout.status not in ('submitted', 'processing', 'unknown')");
  });

  it('checks amount match only when the optional amount field was actually supplied', () => {
    const body = fnBody();
    expect(body).toContain('p_amount is not null and p_amount::numeric is distinct from v_payout.amount');
  });

  it('checks destination match only when the optional recipient field was supplied and the payout has a linked beneficiary', () => {
    const body = fnBody();
    expect(body).toContain('p_masked_recipient_account_number is not null and v_payout.beneficiary_id is not null');
    expect(body).toContain('masked_destination_value = p_masked_recipient_account_number');
  });

  it('never decrypts encrypted_destination_value — destination matching is a masked-string comparison only', () => {
    // The header comment explains WHY no decrypt happens (and so
    // legitimately mentions the column/function by name) — what actually
    // matters is that the function BODY never touches either.
    expect(migration).not.toMatch(/pgp_sym_decrypt/);
    expect(fnBody()).not.toMatch(/encrypted_destination_value/);
  });

  it('checks merchant match as a referential existence check against the merchants table', () => {
    expect(fnBody()).toContain('not exists (select 1 from merchants where id = v_payout.merchant_id)');
  });

  it('a dry run never reaches the merchant_payouts UPDATE branch', () => {
    const body = fnBody();
    expect(body).toContain("v_outcome := case when p_dry_run then 'dry_run_ok' else 'processed' end;");
    expect(body).toContain("if v_outcome = 'processed' then");
  });

  it('records every attempt in selcom_callback_events regardless of outcome, exactly once', () => {
    const body = fnBody();
    const inserts = body.match(/insert into selcom_callback_events/g) ?? [];
    expect(inserts.length).toBe(1);
  });
});

describe('selcom_callback_events — duplicate-processing safeguard and access control', () => {
  it('has a partial unique index preventing more than one processed row per reference_id', () => {
    expect(migration).toContain('create unique index if not exists selcom_callback_events_processed_reference_idx');
    expect(migration).toContain("on selcom_callback_events (reference_id) where outcome = 'processed'");
  });

  it('the unique index excludes dry runs, so a test never collides with a real callback for the same reference', () => {
    const idxSection = migration.slice(
      migration.indexOf('create unique index if not exists selcom_callback_events_processed_reference_idx'),
      migration.indexOf('create policy "Staff can view selcom callback events')
    );
    expect(idxSection).toContain("where outcome = 'processed'");
  });

  it('has RLS enabled with only a select policy gated by payouts.view, no insert/update policy', () => {
    const tableSection = migration.slice(
      migration.indexOf('create table if not exists selcom_callback_events'),
      migration.indexOf('-- ── process_selcom_callback')
    );
    expect(tableSection).toContain('alter table selcom_callback_events enable row level security');
    expect(tableSection).toContain("has_permission('payouts.view')");
    expect(tableSection).not.toMatch(/for insert to authenticated/);
    expect(tableSection).not.toMatch(/for update to authenticated/);
  });

  it('never stores a raw account number column — only masked_* columns', () => {
    const tableSection = migration.slice(
      migration.indexOf('create table if not exists selcom_callback_events'),
      migration.indexOf('alter table selcom_callback_events enable row level security')
    );
    expect(tableSection).toContain('masked_sender_account_number');
    expect(tableSection).toContain('masked_recipient_account_number');
    expect(tableSection).not.toMatch(/\bsender_account_number\b/);
    expect(tableSection).not.toMatch(/\brecipient_account_number\b/);
  });

  it('the dry_run column defaults to false, so only an explicit test call can ever set it true', () => {
    const tableSection = migration.slice(
      migration.indexOf('create table if not exists selcom_callback_events'),
      migration.indexOf('alter table selcom_callback_events enable row level security')
    );
    expect(tableSection).toContain('dry_run boolean not null default false');
  });
});
