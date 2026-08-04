-- Technical transaction visibility for integration troubleshooting.
--
-- The settlement/payout module is now an archived financial prototype
-- (Super Admin only, read-only — see src/lib/archived-financial-prototype.ts).
-- payouts.view is effectively Super Admin/CFO-only as a result. Technology
-- and Operations staff still need to troubleshoot integration failures, so
-- this migration adds a narrow, technical-only read surface: no amount,
-- beneficiary, batch, or approval data — only transaction reference,
-- merchant, integration status, payment-partner status, API response
-- status, timestamp, and technical error. No existing row, policy, or table
-- is modified or removed.

create policy "Integration staff can view payouts for troubleshooting"
  on merchant_payouts for select to authenticated
  using (has_permission('integrations.view'));

create policy "Integration staff can view payout status checks for troubleshooting"
  on merchant_payout_status_checks for select to authenticated
  using (has_permission('integrations.view'));

-- security_invoker = true: still subject to the RLS policies above (this
-- one included) — a caller needs integrations.view or payouts.view to see
-- any rows at all. The view exists to narrow which *columns* are exposed
-- (no amount/beneficiary/batch fields), not to broaden row access beyond
-- what the policies above already grant.
create or replace view v_payout_integration_status as
select
  c.id,
  p.payout_reference as transaction_reference,
  m.business_name as merchant_name,
  c.mapped_status as integration_status,
  coalesce(c.resultcode, c.http_status::text) as api_response_status,
  c.external_status as payment_partner_status,
  c.started_at as checked_at,
  c.error_message as technical_error
from merchant_payout_status_checks c
join merchant_payouts p on p.id = c.payout_id
join merchants m on m.id = p.merchant_id;

alter view v_payout_integration_status set (security_invoker = true);

grant select on v_payout_integration_status to authenticated;
