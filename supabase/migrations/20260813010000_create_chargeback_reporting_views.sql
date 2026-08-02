-- Read-only reporting views for the Merchant Exposure Summary and
-- Chargeback Reporting pages. All SUM/COUNT aggregation happens here in
-- Postgres, exact numeric arithmetic — never summed client-side in
-- JavaScript, matching the convention established for every other
-- financial total this session.

create or replace view merchant_chargeback_exposure as
select
  m.id as merchant_id,
  m.business_name,
  coalesce(cb.open_case_count, 0) as open_case_count,
  coalesce(cb.disputed_amount_open, 0) as disputed_amount_open,
  coalesce(cb.unrecovered_loss, 0) as unrecovered_loss,
  coalesce(h.active_hold_count, 0) as active_hold_count,
  coalesce(h.active_hold_amount, 0) as active_hold_amount
from merchants m
left join (
  select
    merchant_id,
    count(*) filter (where case_status not in ('closed', 'won', 'withdrawn')) as open_case_count,
    coalesce(sum(disputed_amount) filter (where case_status not in ('closed', 'won', 'withdrawn')), 0) as disputed_amount_open,
    coalesce(sum(disputed_amount - coalesce(recovery_amount, 0)) filter (where outcome = 'lost' and recovery_status in ('pending', 'partially_recovered')), 0) as unrecovered_loss
  from chargeback_cases
  group by merchant_id
) cb on cb.merchant_id = m.id
left join (
  select
    merchant_id,
    count(*) as active_hold_count,
    coalesce(sum(hold_amount), 0) as active_hold_amount
  from settlement_holds
  where status = 'active'
  group by merchant_id
) h on h.merchant_id = m.id
where coalesce(cb.open_case_count, 0) > 0 or coalesce(h.active_hold_count, 0) > 0;

create or replace view chargeback_status_counts as
select case_status, count(*) as case_count, coalesce(sum(disputed_amount), 0) as total_disputed
from chargeback_cases
group by case_status;

create or replace view chargeback_reason_counts as
select reason, count(*) as case_count, coalesce(sum(disputed_amount), 0) as total_disputed
from chargeback_cases
group by reason;

create or replace view chargeback_recovery_totals as
select
  count(*) filter (where outcome = 'won') as won_count,
  count(*) filter (where outcome = 'lost') as lost_count,
  count(*) filter (where outcome = 'withdrawn') as withdrawn_count,
  coalesce(sum(disputed_amount) filter (where outcome = 'lost'), 0) as total_lost_amount,
  coalesce(sum(recovery_amount) filter (where outcome = 'lost'), 0) as total_recovered_amount,
  coalesce(sum(disputed_amount - coalesce(recovery_amount, 0)) filter (where outcome = 'lost'), 0) as total_unrecovered_amount
from chargeback_cases;

-- These views inherit RLS from their base tables only for row-level
-- policies expressed as security_invoker; make that explicit so a caller
-- without chargebacks.view/holds.view sees nothing, not everything.
alter view merchant_chargeback_exposure set (security_invoker = true);
alter view chargeback_status_counts set (security_invoker = true);
alter view chargeback_reason_counts set (security_invoker = true);
alter view chargeback_recovery_totals set (security_invoker = true);
