-- Client Compliance, Contract Compliance, Data Protection.

create table if not exists client_compliance (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  compliance_status text not null default 'pending',
  documents_received text[] not null default '{}',
  documents_pending text[] not null default '{}',
  review_date date,
  next_review_date date,
  risk_level text not null default 'low',
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
alter table client_compliance
  add constraint client_compliance_status_check check (compliance_status in ('pending', 'compliant', 'non_compliant', 'under_review'));
alter table client_compliance
  add constraint client_compliance_risk_level_check check (risk_level in ('low', 'medium', 'high', 'critical'));

create trigger client_compliance_set_updated_at before update on client_compliance for each row execute function set_updated_at();

alter table client_compliance enable row level security;
create policy "client_compliance.view can select client_compliance" on client_compliance for select to authenticated using (has_permission('client_compliance.view'));
create policy "client_compliance.manage can insert client_compliance" on client_compliance for insert to authenticated with check (has_permission('client_compliance.manage'));
create policy "client_compliance.manage can update client_compliance" on client_compliance for update to authenticated using (has_permission('client_compliance.manage')) with check (has_permission('client_compliance.manage'));


create table if not exists contract_compliance (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  required_clauses text[] not null default '{}',
  review_status text not null default 'pending',
  findings text,
  approval_status text not null default 'pending',
  reviewer text,
  review_date date,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
alter table contract_compliance
  add constraint contract_compliance_review_status_check check (review_status in ('pending', 'in_review', 'reviewed', 'flagged'));
alter table contract_compliance
  add constraint contract_compliance_approval_status_check check (approval_status in ('pending', 'approved', 'rejected'));

create trigger contract_compliance_set_updated_at before update on contract_compliance for each row execute function set_updated_at();

alter table contract_compliance enable row level security;
create policy "contract_compliance.view can select contract_compliance" on contract_compliance for select to authenticated using (has_permission('contract_compliance.view'));
create policy "contract_compliance.manage can insert contract_compliance" on contract_compliance for insert to authenticated with check (has_permission('contract_compliance.manage'));
create policy "contract_compliance.manage can update contract_compliance" on contract_compliance for update to authenticated using (has_permission('contract_compliance.manage')) with check (has_permission('contract_compliance.manage'));


create table if not exists data_protection_activities (
  id uuid primary key default gen_random_uuid(),
  processing_activity text not null,
  data_category text not null,
  purpose text,
  legal_basis text,
  retention_period text,
  access_roles text[] not null default '{}',
  risk_level text not null default 'low',
  review_date date,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
alter table data_protection_activities
  add constraint data_protection_activities_risk_level_check check (risk_level in ('low', 'medium', 'high', 'critical'));

create trigger data_protection_activities_set_updated_at before update on data_protection_activities for each row execute function set_updated_at();

alter table data_protection_activities enable row level security;
create policy "data_protection.view can select data_protection_activities" on data_protection_activities for select to authenticated using (has_permission('data_protection.view'));
create policy "data_protection.manage can insert data_protection_activities" on data_protection_activities for insert to authenticated with check (has_permission('data_protection.manage'));
create policy "data_protection.manage can update data_protection_activities" on data_protection_activities for update to authenticated using (has_permission('data_protection.manage')) with check (has_permission('data_protection.manage'));
