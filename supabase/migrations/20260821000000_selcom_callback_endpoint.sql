-- Selcom transaction callback endpoint: POST /api/integrations/selcom/
-- callback/[secret]. See src/app/api/integrations/selcom/callback/[secret]/
-- route.ts for the route itself.
--
-- CONFIRMED against Selcom's official callback documentation before writing
-- this (do not re-derive without checking the docs again):
--   - Callbacks are sent by Selcom as a POST to a merchant-configured HTTPS
--     URL when a transaction completes successfully.
--   - Every callback always includes `reference_id` and `status` (status
--     is documented as always "SUCCESS" — callbacks are only ever sent for
--     successful transactions. Failed or unresolved payouts must keep
--     using the existing status-check-service.ts polling path, never this
--     route).
--   - Optional fields, present only if selected during Selcom-side
--     configuration: sender_account_name, sender_account_number,
--     recipient_name, recipient_account_number, amount, charges,
--     selcom_receipt.
--   - NO signature/HMAC verification scheme is documented for this
--     payload. Nothing here invents one. Protection instead comes from:
--       1. An unguessable secret path segment (the callback URL itself,
--          registered with Selcom's merchant portal, known only to us and
--          Selcom) — this is the "secret callback path" Selcom's
--          configuration does support, checked in the route, not here.
--       2. Everything below: reference match, amount match (when the
--          optional field is present), destination match (when present),
--          and current-payout-state validation, all inside one row-locked,
--          guarded function so a wrong/duplicate/replayed callback can
--          never corrupt a payout.
--
-- Design mirrors 20260820000000_selcom_status_check_service.sql: one
-- function that both validates and (only when every gate passes) applies
-- the result, in a single row-locked transaction, with every attempt
-- recorded regardless of outcome. process_selcom_callback() is the ONLY
-- function that ever marks a payout 'successful' from a Selcom callback —
-- it only ever UPDATEs an existing merchant_payouts row found by
-- reference_id; it never INSERTs one, so a callback can never create a new
-- payout.
--
-- Destination matching deliberately never decrypts
-- merchant_settlement_beneficiaries.encrypted_destination_value — per
-- 20260808000000_secure_settlement_beneficiaries.sql's header comment,
-- "there is no decrypt function anywhere ... by design." Adding one just
-- for this would be a new, unnecessary decrypt surface. Instead the
-- callback's recipient_account_number is masked in the application layer
-- (maskCredential() — the exact same function that produced
-- masked_destination_value in the first place) before it ever reaches
-- this function, and the match below is a plain masked-string comparison.
-- This never proves full-account equality, but it does confirm the last
-- few characters match the beneficiary on file without ever touching the
-- encrypted value — a deliberate, honest tradeoff, not an oversight.

-- ── selcom_callback_events: one row per callback attempt, always ───────
create table if not exists selcom_callback_events (
  id uuid primary key default gen_random_uuid(),
  received_at timestamp with time zone not null default now(),

  reference_id text not null,
  raw_status text not null,
  selcom_receipt text,
  -- Decimal string, matching this codebase's money convention — never the
  -- raw JSON number, and never used for arithmetic outside Postgres.
  amount text,
  charges jsonb,

  -- Never a full account number — masked in the app layer before this row
  -- is ever written. See mask_callback_account() equivalent in
  -- src/lib/selcom/callback.ts.
  masked_sender_account_number text,
  sender_account_name text,
  masked_recipient_account_number text,
  recipient_name text,

  source_ip text,

  payout_id uuid references merchant_payouts(id),
  outcome text not null check (outcome in (
    'processed', 'duplicate', 'reference_not_found', 'unexpected_status',
    'amount_mismatch', 'destination_mismatch', 'invalid_state',
    'dry_run_ok'
  )),
  rejection_reason text,
  -- true only for a staff-triggered dry-run validation from the sandbox
  -- Callback Testing panel (process_selcom_callback(p_dry_run => true)),
  -- which never mutates merchant_payouts. The real callback route always
  -- passes false — this column is set by which code path called the
  -- function, never by anything in the HTTP request itself, so it can't
  -- be spoofed by a caller.
  dry_run boolean not null default false,

  created_at timestamp with time zone not null default now()
);

alter table selcom_callback_events enable row level security;
create index if not exists selcom_callback_events_reference_id_idx on selcom_callback_events (reference_id, received_at desc);
create index if not exists selcom_callback_events_payout_id_idx on selcom_callback_events (payout_id);
create index if not exists selcom_callback_events_outcome_idx on selcom_callback_events (outcome, received_at desc);

-- Belt-and-suspenders backstop for "duplicate callback detection" /
-- "unique constraints preventing duplicate processing": the guarded
-- function's row lock + status check already makes a second 'processed'
-- row for the same reference_id impossible in practice, but this makes it
-- impossible at the schema level too, regardless of any future bug in the
-- function body. Excludes dry runs, which never represent a real applied
-- event and must never collide with a genuine callback for the same
-- reference_id.
create unique index if not exists selcom_callback_events_processed_reference_idx
  on selcom_callback_events (reference_id) where outcome = 'processed';

create policy "Staff can view selcom callback events with permission"
  on selcom_callback_events for select to authenticated
  using (has_permission('payouts.view'));

-- No insert/update policy — every write goes through
-- process_selcom_callback() below (the real route calls it via the
-- service-role key, which bypasses RLS entirely).

-- ── process_selcom_callback(): the ONLY function that ever applies a
-- Selcom callback to merchant_payouts. ──────────────────────────────────
create or replace function process_selcom_callback(
  p_reference_id text,
  p_raw_status text,
  p_selcom_receipt text,
  p_amount text,
  p_masked_sender_account_number text,
  p_sender_account_name text,
  p_masked_recipient_account_number text,
  p_recipient_name text,
  p_charges jsonb,
  p_source_ip text,
  p_performed_by text,
  p_dry_run boolean default false
)
returns table (
  outcome text,
  payout_id uuid,
  rejection_reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout record;
  v_payout_id uuid;
  v_outcome text;
  v_rejection text;
begin
  if not (has_permission('payouts.submit') or auth.role() = 'service_role') then
    raise exception 'Missing required permission: payouts.submit';
  end if;

  -- Documented: callbacks are only ever sent for successful transactions.
  -- Anything else arriving here is itself an anomaly worth recording, but
  -- is never applied to the payout, and is checked before even looking the
  -- payout up.
  if p_raw_status is distinct from 'SUCCESS' then
    v_outcome := 'unexpected_status';
    v_rejection := format('Callback status was not SUCCESS (got: %s).', p_raw_status);
  else
    select * into v_payout from merchant_payouts where payout_reference = p_reference_id for update;

    if not found then
      -- "Reject unknown references into a security-review queue": this
      -- row, filterable by outcome = 'reference_not_found', IS that queue
      -- — see the Selcom integration settings page's callback monitoring
      -- panel.
      v_outcome := 'reference_not_found';
      v_rejection := 'No payout found for this reference_id.';
    else
      v_payout_id := v_payout.id;

      if v_payout.status = 'successful' then
        -- A retried/replayed delivery of a callback we already applied.
        -- The row lock above serializes this against a concurrent first
        -- delivery, so this branch is reached safely even under a replay
        -- arriving milliseconds after the original.
        v_outcome := 'duplicate';
        v_rejection := 'Payout is already marked successful.';
      elsif v_payout.status in ('failed', 'reversed', 'cancelled', 'manual_review') then
        -- Not a simple duplicate: a success callback for a payout already
        -- resolved to a DIFFERENT terminal state is a genuine anomaly.
        v_outcome := 'invalid_state';
        v_rejection := format('Payout is already in terminal state: %s.', v_payout.status);
      elsif v_payout.status not in ('submitted', 'processing', 'unknown') then
        v_outcome := 'invalid_state';
        v_rejection := format('Payout has not been submitted yet (status: %s).', v_payout.status);
      elsif not exists (select 1 from merchants where id = v_payout.merchant_id) then
        -- "Merchant match": Selcom's documented callback payload has no
        -- merchant identifier field to compare against, so this is a
        -- referential sanity check — the resolved payout must belong to a
        -- real, existing merchant — rather than a value comparison.
        v_outcome := 'invalid_state';
        v_rejection := 'Payout has no valid associated merchant.';
      elsif p_amount is not null and p_amount::numeric is distinct from v_payout.amount then
        v_outcome := 'amount_mismatch';
        v_rejection := 'Callback amount does not match the payout amount.';
      elsif p_masked_recipient_account_number is not null and v_payout.beneficiary_id is not null
        and not exists (
          select 1 from merchant_settlement_beneficiaries
          where id = v_payout.beneficiary_id and masked_destination_value = p_masked_recipient_account_number
        ) then
        v_outcome := 'destination_mismatch';
        v_rejection := 'Callback destination account does not match the payout beneficiary on file.';
      else
        v_outcome := case when p_dry_run then 'dry_run_ok' else 'processed' end;
      end if;
    end if;
  end if;

  -- Only ever an UPDATE against an existing row found above — never an
  -- INSERT — so a callback can never create a new payout.
  if v_outcome = 'processed' then
    update merchant_payouts set
      status = 'successful',
      provider_payout_reference = coalesce(p_selcom_receipt, provider_payout_reference),
      selcom_receipt = coalesce(p_selcom_receipt, selcom_receipt),
      completed_at = now(),
      last_status_check_at = now(),
      next_status_check_at = null
    where id = v_payout_id;

    insert into merchant_payout_events (payout_id, event_type, performed_by, notes)
    values (v_payout_id, 'callback_success', p_performed_by, 'Selcom callback confirmed successful disbursement.');
  end if;

  insert into selcom_callback_events (
    reference_id, raw_status, selcom_receipt, amount,
    masked_sender_account_number, sender_account_name,
    masked_recipient_account_number, recipient_name, charges,
    source_ip, payout_id, outcome, dry_run, rejection_reason
  ) values (
    p_reference_id, p_raw_status, p_selcom_receipt, p_amount,
    p_masked_sender_account_number, p_sender_account_name,
    p_masked_recipient_account_number, p_recipient_name, p_charges,
    p_source_ip, v_payout_id, v_outcome, p_dry_run, v_rejection
  );

  return query select v_outcome, v_payout_id, v_rejection;
end;
$$;

revoke execute on function process_selcom_callback(text, text, text, text, text, text, text, text, jsonb, text, text, boolean) from public;
grant execute on function process_selcom_callback(text, text, text, text, text, text, text, text, jsonb, text, text, boolean) to authenticated;
revoke execute on function process_selcom_callback(text, text, text, text, text, text, text, text, jsonb, text, text, boolean) from anon;
