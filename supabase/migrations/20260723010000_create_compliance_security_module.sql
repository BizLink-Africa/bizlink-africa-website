-- Compliance & Security module: periodic compliance reviews (KYC, licensing,
-- data protection, contract/regulatory) and a security incident/activity
-- log. Fills permission sets seeded in the RBAC migration (compliance.*,
-- security.*, dashboard.compliance.view) that had no table or page using
-- them yet — notably the compliance_security role currently holds neither
-- of its namesake permissions, which this migration corrects.

create table if not exists compliance_reviews (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  related_client_id uuid references clients(id) on delete set null,
  status text not null default 'pending',
  reviewer text,
  due_date date,
  completed_date date,
  findings text,
  notes text,
  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table compliance_reviews
  add constraint compliance_reviews_category_check check (category in (
    'kyc', 'license', 'data_protection', 'contract', 'regulatory', 'other'
  ));

alter table compliance_reviews
  add constraint compliance_reviews_status_check check (status in (
    'pending', 'in_review', 'compliant', 'non_compliant', 'remediation_required'
  ));

create trigger compliance_reviews_set_updated_at
  before update on compliance_reviews
  for each row
  execute function set_updated_at();

create table if not exists security_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  severity text not null default 'info',
  description text not null,
  actor text,
  ip_address text,
  status text not null default 'open',
  resolved_by text,
  resolved_at timestamp with time zone,
  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table security_events
  add constraint security_events_event_type_check check (event_type in (
    'login_failure', 'permission_change', 'suspicious_activity', 'data_export', 'access_review', 'other'
  ));

alter table security_events
  add constraint security_events_severity_check check (severity in ('info', 'warning', 'critical'));

alter table security_events
  add constraint security_events_status_check check (status in (
    'open', 'investigating', 'resolved', 'false_positive'
  ));

create trigger security_events_set_updated_at
  before update on security_events
  for each row
  execute function set_updated_at();

-- ============================================================
-- Permissions: compliance.*/security.*/dashboard.compliance.view already
-- exist in the catalog (seeded dormant) — grant them to compliance_security
-- (closing the gap noted above), give ceo broad view-only visibility, and
-- give cto security.view since it already owns integrations/tech.
-- ============================================================

insert into role_permissions (role_id, permission_id) values
  ('compliance_security', 'compliance.view'), ('compliance_security', 'compliance.manage'),
  ('compliance_security', 'security.view'), ('compliance_security', 'security.manage'),
  ('compliance_security', 'dashboard.compliance.view'),
  ('ceo', 'dashboard.compliance.view'), ('ceo', 'compliance.view'), ('ceo', 'security.view'),
  ('cto', 'security.view')
on conflict do nothing;

-- ============================================================
-- RLS
-- ============================================================

alter table compliance_reviews enable row level security;
create policy "compliance.view can select reviews" on compliance_reviews for select to authenticated using (has_permission('compliance.view'));
create policy "compliance.manage can insert reviews" on compliance_reviews for insert to authenticated with check (has_permission('compliance.manage'));
create policy "compliance.manage can update reviews" on compliance_reviews for update to authenticated using (has_permission('compliance.manage')) with check (has_permission('compliance.manage'));

alter table security_events enable row level security;
create policy "security.view can select events" on security_events for select to authenticated using (has_permission('security.view'));
create policy "security.manage can insert events" on security_events for insert to authenticated with check (has_permission('security.manage'));
create policy "security.manage can update events" on security_events for update to authenticated using (has_permission('security.manage')) with check (has_permission('security.manage'));
