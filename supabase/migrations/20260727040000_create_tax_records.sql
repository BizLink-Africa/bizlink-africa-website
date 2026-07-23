-- Tax Records: a simple ledger of tax filings/obligations (VAT, PAYE,
-- withholding, etc.) — separate from the invoice-level tax_amount/
-- tax_percentage columns, which track tax charged to clients, not tax owed
-- to the Tanzania Revenue Authority.

insert into permissions (id, module, description) values
  ('tax_records.view', 'tax_records', 'View tax records'),
  ('tax_records.manage', 'tax_records', 'Create/update tax records')
on conflict (id) do nothing;

create table if not exists tax_records (
  id uuid primary key default gen_random_uuid(),
  tax_period text not null,
  tax_category text not null,
  taxable_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  filing_status text not null default 'pending',
  reference text,
  notes text,
  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table tax_records
  add constraint tax_records_category_check check (tax_category in (
    'vat', 'paye', 'withholding', 'skills_development_levy', 'other'
  ));
alter table tax_records
  add constraint tax_records_filing_status_check check (filing_status in (
    'pending', 'filed', 'paid'
  ));

create trigger tax_records_set_updated_at
  before update on tax_records
  for each row
  execute function set_updated_at();

alter table tax_records enable row level security;
create policy "tax_records.view can select tax_records" on tax_records for select to authenticated using (has_permission('tax_records.view'));
create policy "tax_records.manage can insert tax_records" on tax_records for insert to authenticated with check (has_permission('tax_records.manage'));
create policy "tax_records.manage can update tax_records" on tax_records for update to authenticated using (has_permission('tax_records.manage')) with check (has_permission('tax_records.manage'));

insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'tax_records.view'), ('super_admin', 'tax_records.manage'),
  ('cfo', 'tax_records.view'), ('cfo', 'tax_records.manage'),
  ('ceo', 'tax_records.view')
on conflict do nothing;
