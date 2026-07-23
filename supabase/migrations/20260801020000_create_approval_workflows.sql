-- Governance: Approval Workflows. approval_workflows holds the CONFIGURED
-- rule ("Expenses over threshold route to this approver role"); it does not
-- itself execute anything — Expenses/Contracts/Proformas keep their own
-- existing approve actions (expenses.approve etc.), same as
-- access_reviews never mutating roles. approval_requests is a manually
-- logged queue (same "no live telemetry" pattern as Technology's
-- api_request_logs/background_jobs) staff can raise against a workflow and
-- an approver can decide on, giving Governance something real to track
-- ("Pending approval workflow actions") without re-plumbing every module's
-- existing approval flow.

create table if not exists approval_workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text,
  approver_role text references roles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table approval_workflows
  add constraint approval_workflows_category_check check (category in (
    'contracts', 'proformas', 'invoices', 'expenses', 'access_requests', 'policies', 'high_risk_operations'
  ));

create trigger approval_workflows_set_updated_at
  before update on approval_workflows
  for each row
  execute function set_updated_at();

create table if not exists approval_requests (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references approval_workflows(id) on delete set null,
  category text not null,
  subject_label text not null,
  amount numeric(14, 2),
  requested_by text not null,
  status text not null default 'pending',
  decision_notes text,
  decided_by text,
  decided_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

alter table approval_requests
  add constraint approval_requests_category_check check (category in (
    'contracts', 'proformas', 'invoices', 'expenses', 'access_requests', 'policies', 'high_risk_operations'
  ));
alter table approval_requests
  add constraint approval_requests_status_check check (status in ('pending', 'approved', 'rejected'));

alter table approval_workflows enable row level security;
create policy "approval_workflows.view can select approval_workflows" on approval_workflows for select to authenticated using (has_permission('approval_workflows.view'));
create policy "approval_workflows.manage can insert approval_workflows" on approval_workflows for insert to authenticated with check (has_permission('approval_workflows.manage'));
create policy "approval_workflows.manage can update approval_workflows" on approval_workflows for update to authenticated using (has_permission('approval_workflows.manage')) with check (has_permission('approval_workflows.manage'));

alter table approval_requests enable row level security;
create policy "approval_workflows.view can select approval_requests" on approval_requests for select to authenticated using (has_permission('approval_workflows.view'));
create policy "approval_workflows.view can insert approval_requests" on approval_requests for insert to authenticated with check (has_permission('approval_workflows.view'));
create policy "approval_workflows.manage can update approval_requests" on approval_requests for update to authenticated using (has_permission('approval_workflows.manage')) with check (has_permission('approval_workflows.manage'));

insert into permissions (id, module, description) values
  ('approval_workflows.view', 'approval_workflows', 'View approval workflows and requests'),
  ('approval_workflows.manage', 'approval_workflows', 'Configure approval workflows and decide requests')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id)
  select 'super_admin', id from permissions
  where id in ('approval_workflows.view', 'approval_workflows.manage')
    and id not in (select permission_id from role_permissions where role_id = 'super_admin')
on conflict do nothing;

insert into role_permissions (role_id, permission_id) values
  ('ceo', 'approval_workflows.view'), ('ceo', 'approval_workflows.manage')
on conflict do nothing;

insert into approval_workflows (name, category, description, approver_role) values
  ('Contract Approval', 'contracts', 'Contracts route to the CEO before being sent to the client.', 'ceo'),
  ('Proforma Approval', 'proformas', 'Proforma invoices above standard terms require CFO sign-off.', 'cfo'),
  ('Invoice Approval', 'invoices', 'High-value invoices are reviewed by the CFO before issuing.', 'cfo'),
  ('Expense Approval', 'expenses', 'Expenses follow the two-stage CFO/CEO approval already enforced on the Finance side.', 'cfo'),
  ('Access Request Approval', 'access_requests', 'New/elevated access requests are reviewed by Compliance & Security.', 'compliance_security'),
  ('Policy Approval', 'policies', 'New or revised policies are approved by the CEO before publishing.', 'ceo'),
  ('High-Risk Operation Approval', 'high_risk_operations', 'Any high-risk platform operation requires Super Admin sign-off.', 'super_admin')
on conflict do nothing;
