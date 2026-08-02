-- Extends RBAC for merchant finance operations: three new Finance roles
-- with genuine separation of duties (not just identity-based
-- maker-checker, which already existed — this adds a role-level backstop
-- on top of it), a Merchant Onboarding Officer role, read-only visibility
-- for Auditor across every finance module built this session, merchant
-- self-service RLS for their own transactions/payouts, and an extended
-- audit_logs schema.
--
-- Every existing role (super_admin, ceo, cfo, cto, operations,
-- customer_support, marketing, compliance_security, auditor) and every
-- existing grant is left untouched — this migration only adds new roles
-- and new grants, never revokes or renames anything already relied upon.

-- ── New roles ────────────────────────────────────────────────────────────
insert into roles (id, name, description, is_system) values
  ('finance_maker', 'Finance Maker', 'Prepares settlement batches, requests payouts, commission rules, chargeback cases and reversals. Cannot approve or release money.', true),
  ('finance_checker', 'Finance Checker', 'Independently reviews what a Finance Maker prepared. Cannot prepare new requests and cannot give final release approval.', true),
  ('finance_approver', 'Finance Approver', 'Final approval authority for settlement batches, payouts and chargeback resolutions.', true),
  ('merchant_onboarding_officer', 'Merchant Onboarding Officer', 'Manages merchant applications, KYC coordination and till setup during onboarding.', true)
on conflict (id) do nothing;

-- ── Finance Maker: every "prepare / request / manage" permission across
-- the finance modules — structurally never settlement.approve,
-- payouts.approve, commission_rules.approve, chargebacks.resolve,
-- reversals.approve or any hold permission. "Finance Maker cannot approve
-- their own batch" is enforced twice over: by identity (already existed)
-- and now by this role simply never holding an approve permission. ──────
insert into role_permissions (role_id, permission_id) values
  ('finance_maker', 'settlement.view'), ('finance_maker', 'settlement.prepare'),
  ('finance_maker', 'payouts.view'), ('finance_maker', 'payouts.manage'),
  ('finance_maker', 'commission_rules.view'), ('finance_maker', 'commission_rules.manage'),
  ('finance_maker', 'chargebacks.view'), ('finance_maker', 'chargebacks.manage'),
  ('finance_maker', 'reversals.view'), ('finance_maker', 'reversals.manage'),
  ('finance_maker', 'collections.view'), ('finance_maker', 'collections.manage'), ('finance_maker', 'collections.reconcile'),
  ('finance_maker', 'financial_reports.view'), ('finance_maker', 'merchants.view')
on conflict do nothing;

-- ── Finance Checker: the independent second signature on the two-stage
-- workflows (commission rules, reversals, beneficiary changes) — never a
-- final money-release action, never able to prepare the original request.
insert into role_permissions (role_id, permission_id) values
  ('finance_checker', 'settlement.view'), ('finance_checker', 'settlement.review'),
  ('finance_checker', 'payouts.view'),
  ('finance_checker', 'commission_rules.view'), ('finance_checker', 'commission_rules.approve'),
  ('finance_checker', 'chargebacks.view'),
  ('finance_checker', 'reversals.view'), ('finance_checker', 'reversals.approve'),
  ('finance_checker', 'collections.view'),
  ('finance_checker', 'merchant_beneficiaries.view'), ('finance_checker', 'merchant_beneficiaries.approve'),
  ('finance_checker', 'financial_reports.view'), ('finance_checker', 'merchants.view')
on conflict do nothing;

-- ── Finance Approver: final release-of-money / final-determination
-- actions only — settlement approval/processing, payout approval/
-- submission, chargeback resolution, reconciliation-run approval (which
-- gates settlement eligibility). Never settlement.prepare, never
-- payouts.manage, never a compliance hold permission.
insert into role_permissions (role_id, permission_id) values
  ('finance_approver', 'settlement.view'), ('finance_approver', 'settlement.approve'), ('finance_approver', 'settlement.process'),
  ('finance_approver', 'payouts.view'), ('finance_approver', 'payouts.approve'), ('finance_approver', 'payouts.submit'),
  ('finance_approver', 'commission_rules.view'),
  ('finance_approver', 'chargebacks.view'), ('finance_approver', 'chargebacks.resolve'),
  ('finance_approver', 'reversals.view'),
  ('finance_approver', 'collections.view'), ('finance_approver', 'collections.approve'),
  ('finance_approver', 'financial_reports.view'), ('finance_approver', 'merchants.view')
on conflict do nothing;

-- ── Merchant Onboarding Officer: merchant applications, KYC coordination,
-- till setup and beneficiary intake — never a finance approve permission,
-- never a compliance hold permission.
insert into role_permissions (role_id, permission_id) values
  ('merchant_onboarding_officer', 'merchants.view'), ('merchant_onboarding_officer', 'merchants.manage'),
  ('merchant_onboarding_officer', 'merchant_kyc.view'), ('merchant_onboarding_officer', 'merchant_kyc.manage'),
  ('merchant_onboarding_officer', 'merchant_kyc_documents.view'), ('merchant_onboarding_officer', 'merchant_kyc_documents.manage'),
  ('merchant_onboarding_officer', 'merchant_kyc_documents.metadata_view'), ('merchant_onboarding_officer', 'merchant_kyc_identity_documents.view'),
  ('merchant_onboarding_officer', 'merchant_tills.view'), ('merchant_onboarding_officer', 'merchant_tills.manage'),
  ('merchant_onboarding_officer', 'onboarding.view'), ('merchant_onboarding_officer', 'onboarding.manage'),
  ('merchant_onboarding_officer', 'merchant_beneficiaries.view'), ('merchant_onboarding_officer', 'merchant_beneficiaries.manage')
on conflict do nothing;

-- ── Auditor: "Auditor is read-only" — extend existing read-only auditor
-- with view access to every finance module built this session. Every one
-- of these ends in .view; none is a manage/approve/prepare/resolve/hold
-- permission, preserving the read-only guarantee.
insert into role_permissions (role_id, permission_id) values
  ('auditor', 'settlement.view'), ('auditor', 'payouts.view'), ('auditor', 'commission_rules.view'),
  ('auditor', 'chargebacks.view'), ('auditor', 'holds.view'), ('auditor', 'reversals.view'),
  ('auditor', 'collections.view'), ('auditor', 'financial_reports.view')
on conflict do nothing;

-- ── Merchant self-service RLS: "Merchant User sees only their own
-- business, transactions, payouts and statements." merchants already has
-- a "Merchant can view own merchant record" policy (see
-- 20260805000000_create_merchant_portal_foundation.sql) and statements go
-- through generate_merchant_statement()'s own dual-mode check — the two
-- gaps closed here are collection_transactions and merchant_payouts,
-- which previously had no merchant-facing SELECT policy at all. ─────────
create policy "Merchant can view own transactions"
  on collection_transactions for select to authenticated
  using (exists (
    select 1 from merchant_users
    where merchant_users.user_id = auth.uid()
      and merchant_users.merchant_id = collection_transactions.merchant_id
      and merchant_users.is_active = true
  ));

create policy "Merchant can view own payouts"
  on merchant_payouts for select to authenticated
  using (exists (
    select 1 from merchant_users
    where merchant_users.user_id = auth.uid()
      and merchant_users.merchant_id = merchant_payouts.merchant_id
      and merchant_users.is_active = true
  ));

-- ── audit_logs schema extension ──────────────────────────────────────────
-- "Record actor, role, action, module, record, old values, new values,
-- reason, timestamp, IP, user agent, correlation ID" — actor/action/module/
-- record/old/new/timestamp already existed (performed_by, action_type,
-- module, record_id, old_value, new_value, created_at). This adds the
-- five that were missing. All nullable and additive — no existing row or
-- caller is affected; new callers populate what they can.
alter table audit_logs
  add column if not exists role text,
  add column if not exists reason text,
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists correlation_id text;

-- "Financial audit logs should be append-only where practical" — there was
-- already no UPDATE/DELETE policy on audit_logs (RLS default-denies both),
-- so this is a structural backstop against a future migration accidentally
-- adding one, scoped to the record types that actually matter here.
create or replace function block_financial_audit_log_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.record_type in ('finance', 'compliance') then
    raise exception 'Financial and compliance audit log entries are append-only and cannot be modified.';
  end if;
  return new;
end;
$$;

drop trigger if exists audit_logs_financial_append_only on audit_logs;
create trigger audit_logs_financial_append_only
  before update or delete on audit_logs
  for each row
  execute function block_financial_audit_log_mutation();
