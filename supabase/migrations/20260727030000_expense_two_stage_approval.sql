-- Expense Approvals: makes expense_high_value_threshold (already
-- configurable via company_settings, already shown on the Expenses page)
-- a real workflow trigger instead of just a cosmetic "High Value" label.
-- Normal expenses: submitted -> approved (CFO, expenses.approve).
-- High-value expenses: submitted -> pending_ceo_approval (CFO) ->
--   approved (CEO, expenses.ceo_approve). Mirrors the existing two-stage
-- pattern already used for contracts (pending_compliance_review ->
-- pending_ceo_approval -> approved).

alter table expenses drop constraint if exists expenses_status_check;
alter table expenses
  add constraint expenses_status_check check (status in (
    'draft', 'submitted', 'pending_approval', 'pending_ceo_approval',
    'approved', 'rejected', 'paid', 'cancelled'
  ));

insert into permissions (id, module, description) values
  ('expenses.ceo_approve', 'expenses', 'Give final CEO approval to a high-value expense')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'expenses.ceo_approve'),
  ('ceo', 'expenses.ceo_approve')
on conflict do nothing;
