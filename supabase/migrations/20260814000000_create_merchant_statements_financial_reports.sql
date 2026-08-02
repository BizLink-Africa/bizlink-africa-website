-- Merchant Statements and Financial Reports.
--
-- "Statements must be generated server-side" — generate_merchant_statement()
-- below is the ONLY place statement figures are computed, entirely in
-- Postgres numeric arithmetic; the app layer only ever renders/exports what
-- this function returns, never recomputes a total.
--
-- "Clients may access only their own statements. Super Admin and
-- authorised Finance roles may access all." — generate_merchant_statement()
-- is dual-mode: it accepts a caller who either (a) holds
-- financial_reports.view (staff), or (b) is an active merchant_users
-- member of the exact merchant_id requested. Nothing about which branch
-- was taken ever escapes the function, so a merchant calling it can never
-- pass a different merchant_id and see someone else's numbers — the check
-- happens before a single row is read.
--
-- "Do not expose confidential partner rates" — this function and the
-- reporting views below never touch commission_fee_rules.percentage_rate /
-- fixed_fee_amount. Every figure is an already-computed dollar amount
-- (bizlink_commission, net_merchant_amount, etc.) already stored on
-- collection_transactions — the rate itself is structurally unreachable
-- from here.

-- ── Reporting views (SUM/GROUP BY in Postgres, never in the browser) ────
create or replace view v_daily_collections_by_merchant as
select
  t.collected_at::date as collection_date,
  t.merchant_id,
  m.business_name,
  count(*) as transaction_count,
  coalesce(sum(t.gross_amount), 0) as gross_amount,
  coalesce(sum(t.provider_fee), 0) as provider_fee_total,
  coalesce(sum(t.bizlink_commission), 0) as bizlink_commission_total,
  coalesce(sum(t.net_merchant_amount), 0) as net_amount
from collection_transactions t
join merchants m on m.id = t.merchant_id
group by t.collected_at::date, t.merchant_id, m.business_name;

alter view v_daily_collections_by_merchant set (security_invoker = true);

-- "Outstanding merchant liabilities": the unsettled balance as of right
-- now — matched transactions whose batch/line has no successful payout
-- yet (a transaction never batched at all is trivially unsettled too).
create or replace view v_merchant_outstanding_liabilities as
select
  m.id as merchant_id,
  m.business_name,
  count(t.id) as unsettled_transaction_count,
  coalesce(sum(t.net_merchant_amount), 0) as unsettled_net_amount
from merchants m
join collection_transactions t on t.merchant_id = m.id
where t.reconciliation_status = 'matched'
  and not exists (
    select 1
    from settlement_batch_lines sbl
    join merchant_payouts p on p.settlement_batch_line_id = sbl.id and p.status = 'successful'
    where sbl.batch_id = t.settlement_batch_id and sbl.merchant_id = t.merchant_id
  )
group by m.id, m.business_name
having coalesce(sum(t.net_merchant_amount), 0) <> 0;

alter view v_merchant_outstanding_liabilities set (security_invoker = true);

-- ── generate_merchant_statement() ────────────────────────────────────────
create or replace function generate_merchant_statement(p_merchant_id uuid, p_period_start date, p_period_end date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_staff boolean;
  v_is_own_merchant boolean;
  v_merchant record;
  v_beneficiary record;
  v_opening numeric;
  v_gross numeric;
  v_provider_fee numeric;
  v_commission numeric;
  v_adjustment numeric;
  v_period_net numeric;
  v_reversals numeric;
  v_chargebacks numeric;
  v_paid_this_period numeric;
  v_closing numeric;
  v_payout_reference text;
  v_transaction_count integer;
begin
  if p_period_end < p_period_start then
    raise exception 'period_end cannot be before period_start';
  end if;

  v_is_staff := has_permission('financial_reports.view');
  v_is_own_merchant := exists (
    select 1 from merchant_users where user_id = auth.uid() and merchant_id = p_merchant_id and is_active = true
  );
  if not (v_is_staff or v_is_own_merchant) then
    raise exception 'You do not have permission to view this merchant statement';
  end if;

  select * into v_merchant from merchants where id = p_merchant_id;
  if not found then
    raise exception 'Merchant not found';
  end if;

  select * into v_beneficiary from merchant_settlement_beneficiaries
  where merchant_id = p_merchant_id and is_primary = true
  order by created_at desc
  limit 1;

  select coalesce(sum(t.net_merchant_amount), 0) into v_opening
  from collection_transactions t
  where t.merchant_id = p_merchant_id
    and t.reconciliation_status = 'matched'
    and t.collected_at::date < p_period_start
    and not exists (
      select 1
      from settlement_batch_lines sbl
      join merchant_payouts p on p.settlement_batch_line_id = sbl.id and p.status = 'successful'
      where sbl.batch_id = t.settlement_batch_id and sbl.merchant_id = t.merchant_id
    );

  select
    count(*), coalesce(sum(t.gross_amount), 0), coalesce(sum(t.provider_fee), 0),
    coalesce(sum(t.bizlink_commission), 0), coalesce(sum(t.other_authorised_adjustment), 0), coalesce(sum(t.net_merchant_amount), 0)
  into v_transaction_count, v_gross, v_provider_fee, v_commission, v_adjustment, v_period_net
  from collection_transactions t
  where t.merchant_id = p_merchant_id
    and t.collected_at::date between p_period_start and p_period_end;

  select coalesce(sum(r.reversal_amount), 0) into v_reversals
  from manual_reversal_requests r
  where r.merchant_id = p_merchant_id
    and r.status = 'completed'
    and r.completed_at::date between p_period_start and p_period_end;

  select coalesce(sum(c.disputed_amount), 0) into v_chargebacks
  from chargeback_cases c
  where c.merchant_id = p_merchant_id
    and c.outcome = 'lost'
    and c.resolved_at::date between p_period_start and p_period_end;

  select coalesce(sum(p.amount), 0) into v_paid_this_period
  from merchant_payouts p
  join settlement_batch_lines sbl on sbl.id = p.settlement_batch_line_id
  where sbl.merchant_id = p_merchant_id
    and p.status = 'successful'
    and p.completed_at::date between p_period_start and p_period_end;

  select p.payout_reference into v_payout_reference
  from merchant_payouts p
  join settlement_batch_lines sbl on sbl.id = p.settlement_batch_line_id
  where sbl.merchant_id = p_merchant_id
    and p.status = 'successful'
    and p.completed_at::date between p_period_start and p_period_end
  order by p.completed_at desc
  limit 1;

  v_closing := v_opening + v_period_net - v_reversals - v_chargebacks - v_paid_this_period;

  return jsonb_build_object(
    'statementPeriodStart', p_period_start,
    'statementPeriodEnd', p_period_end,
    'merchantId', p_merchant_id,
    'merchantName', v_merchant.business_name,
    'merchantReference', v_merchant.partner_merchant_reference,
    'tillReference', v_merchant.till_reference,
    'openingUnsettledBalance', v_opening,
    'transactionCount', v_transaction_count,
    'grossCollections', v_gross,
    'providerFees', v_provider_fee,
    'bizlinkCommission', v_commission,
    'adjustments', v_adjustment,
    'reversals', v_reversals,
    'chargebacks', v_chargebacks,
    'netSettlement', v_period_net,
    'paidThisPeriod', v_paid_this_period,
    'payoutReference', v_payout_reference,
    'settlementDestinationMasked', v_beneficiary.masked_destination_value,
    'closingUnsettledBalance', v_closing
  );
end;
$$;

revoke execute on function generate_merchant_statement(uuid, date, date) from public;
grant execute on function generate_merchant_statement(uuid, date, date) to authenticated;
revoke execute on function generate_merchant_statement(uuid, date, date) from anon;

-- ── Permission ───────────────────────────────────────────────────────────
-- Deliberately a single permission covering statements and every report —
-- "Super Admin and authorised Finance roles may access all" names exactly
-- two tiers, not the broader compliance/ceo visibility granted to earlier
-- modules this session.
insert into permissions (id, module, description) values
  ('financial_reports.view', 'financial_reports', 'View merchant statements and all financial reports (Super Admin / authorised Finance only)')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id)
  select 'super_admin', id from permissions
  where id not in (select permission_id from role_permissions where role_id = 'super_admin')
on conflict do nothing;

insert into role_permissions (role_id, permission_id) values
  ('cfo', 'financial_reports.view')
on conflict do nothing;
