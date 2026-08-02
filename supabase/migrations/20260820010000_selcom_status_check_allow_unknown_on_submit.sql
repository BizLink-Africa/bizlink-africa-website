-- Small follow-up to 20260820000000: mapSelcomTransactionStatus() (the
-- single central external->internal status config) now defaults an
-- unrecognised Selcom status to 'unknown' rather than 'processing' — a
-- more honest signal ("we don't know") than assuming still-in-progress.
-- That means the initial transaction/process response could, in a rare
-- undocumented-response case, map to 'unknown' too, not just
-- 'processing'/'successful'/'failed'. Widen apply_merchant_payout_result's
-- accepted status list to match — same signature as before, a true
-- in-place replace.
create or replace function apply_merchant_payout_result(
  p_payout_id uuid,
  p_status text,
  p_provider_payout_reference text,
  p_failure_code text,
  p_failure_reason text,
  p_recipient_name text default null,
  p_purpose text default null,
  p_remarks text default null,
  p_initial_response jsonb default null,
  p_selcom_receipt text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout record;
  v_performer text;
  v_max_hours integer;
begin
  if not has_permission('payouts.submit') then
    raise exception 'Missing required permission: payouts.submit';
  end if;
  if p_status not in ('processing', 'successful', 'failed', 'unknown') then
    raise exception 'Invalid payout result status: %', p_status;
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_payout from merchant_payouts where id = p_payout_id for update;
  if not found then
    raise exception 'Payout not found';
  end if;
  if v_payout.status not in ('submitted', 'processing') then
    raise exception 'Only a submitted or processing payout can have its result applied';
  end if;

  select coalesce(payout_status_check_max_hours, 48) into v_max_hours from company_settings limit 1;

  update merchant_payouts set
    status = p_status,
    provider_payout_reference = coalesce(p_provider_payout_reference, provider_payout_reference),
    failure_code = case when p_status = 'failed' then p_failure_code else failure_code end,
    failure_reason = case when p_status = 'failed' then p_failure_reason else failure_reason end,
    completed_at = case when p_status in ('successful', 'failed') then now() else completed_at end,
    recipient_name = coalesce(p_recipient_name, recipient_name),
    purpose = coalesce(p_purpose, purpose),
    remarks = coalesce(p_remarks, remarks),
    initial_response = coalesce(p_initial_response, initial_response),
    selcom_receipt = coalesce(p_selcom_receipt, selcom_receipt),
    next_status_check_at = case when p_status in ('processing', 'unknown') then now() + interval '1 minute' else null end,
    status_check_expires_at = case
      when p_status in ('processing', 'unknown') then coalesce(status_check_expires_at, now() + make_interval(hours => v_max_hours))
      else status_check_expires_at
    end
  where id = p_payout_id;

  insert into merchant_payout_events (payout_id, event_type, performed_by, notes)
  values (p_payout_id, 'result_' || p_status, v_performer, p_failure_reason);
end;
$$;

revoke execute on function apply_merchant_payout_result(uuid, text, text, text, text, text, text, text, jsonb, text) from public;
grant execute on function apply_merchant_payout_result(uuid, text, text, text, text, text, text, text, jsonb, text) to authenticated;
revoke execute on function apply_merchant_payout_result(uuid, text, text, text, text, text, text, text, jsonb, text) from anon;
