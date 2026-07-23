-- Finance module: proforma invoices, invoices, invoice payments, expenses.
-- Money fields use numeric(14,2) — never floating point. Fee categories are
-- fixed named columns (setup fee, implementation fee, etc.) rather than a
-- generic line-items table, matching the exact field list requested;
-- subtotal/tax/total are computed and stored by the app layer at
-- create/update time (not DB generated columns), consistent with how this
-- codebase already computes derived values elsewhere.

-- ============================================================
-- 1. Atomic document numbering (INV-2026-0001, PRO-2026-0001, ...)
-- ============================================================

create table if not exists finance_number_sequences (
  prefix text not null,
  year int not null,
  next_number int not null default 1,
  primary key (prefix, year)
);

create or replace function next_finance_number(seq_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_year int := extract(year from now())::int;
  seq_number int;
begin
  insert into finance_number_sequences (prefix, year, next_number)
  values (seq_prefix, current_year, 2)
  on conflict (prefix, year) do update set next_number = finance_number_sequences.next_number + 1
  returning next_number - 1 into seq_number;

  return seq_prefix || '-' || current_year || '-' || lpad(seq_number::text, 4, '0');
end;
$$;

-- ============================================================
-- 2. Company finance settings (extends the existing singleton table)
-- ============================================================

alter table company_settings add column if not exists default_currency text not null default 'TZS';
alter table company_settings add column if not exists vat_percentage numeric(5,2) not null default 18;
alter table company_settings add column if not exists invoice_prefix text not null default 'INV';
alter table company_settings add column if not exists proforma_prefix text not null default 'PRO';
alter table company_settings add column if not exists default_payment_terms_days int not null default 14;
alter table company_settings add column if not exists expense_high_value_threshold numeric(14,2) not null default 500000;

-- ============================================================
-- 3. Invoices (created before proforma_invoices to break the circular
--    reference — proformas link to their converted invoice, invoices link
--    to their source proforma).
-- ============================================================

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  proforma_id uuid,
  client_id uuid references clients(id) on delete set null,
  client_business_name text not null,
  client_address text,
  client_email text,
  client_phone text,
  service_summary text,

  setup_fee numeric(14,2) not null default 0,
  implementation_fee numeric(14,2) not null default 0,
  ai_automation_fee numeric(14,2) not null default 0,
  social_commerce_fee numeric(14,2) not null default 0,
  api_integration_fee numeric(14,2) not null default 0,
  subscription_fee numeric(14,2) not null default 0,
  support_fee numeric(14,2) not null default 0,
  other_charges numeric(14,2) not null default 0,
  other_charges_description text,

  currency text not null default 'TZS',
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  tax_percentage numeric(5,2) not null default 18,
  tax_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  outstanding_balance numeric(14,2) not null default 0,

  issue_date date,
  due_date date,
  payment_terms text,
  payment_reference text,
  notes text,

  status text not null default 'draft',
  created_by text,
  approved_by text,
  issued_by text,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table invoices
  add constraint invoices_status_check check (status in (
    'draft', 'pending_approval', 'approved', 'issued', 'partially_paid',
    'paid', 'overdue', 'cancelled', 'written_off'
  ));

create trigger invoices_set_updated_at
  before update on invoices
  for each row
  execute function set_updated_at();

-- ============================================================
-- 4. Proforma invoices
-- ============================================================

create table if not exists proforma_invoices (
  id uuid primary key default gen_random_uuid(),
  proforma_number text not null unique,
  client_id uuid references clients(id) on delete set null,
  client_business_name text not null,
  client_address text,
  client_email text,
  client_phone text,
  service_summary text,

  setup_fee numeric(14,2) not null default 0,
  implementation_fee numeric(14,2) not null default 0,
  ai_automation_fee numeric(14,2) not null default 0,
  social_commerce_fee numeric(14,2) not null default 0,
  api_integration_fee numeric(14,2) not null default 0,
  subscription_fee numeric(14,2) not null default 0,
  support_fee numeric(14,2) not null default 0,
  other_charges numeric(14,2) not null default 0,
  other_charges_description text,

  currency text not null default 'TZS',
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  tax_percentage numeric(5,2) not null default 18,
  tax_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,

  valid_until date,
  payment_terms text,
  notes text,
  terms_and_conditions text,

  status text not null default 'draft',
  created_by text,
  approved_by text,
  converted_invoice_id uuid references invoices(id) on delete set null,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table proforma_invoices
  add constraint proforma_invoices_status_check check (status in (
    'draft', 'pending_approval', 'approved', 'sent', 'accepted',
    'rejected', 'expired', 'converted', 'cancelled'
  ));

create trigger proforma_invoices_set_updated_at
  before update on proforma_invoices
  for each row
  execute function set_updated_at();

alter table invoices
  add constraint invoices_proforma_id_fkey foreign key (proforma_id) references proforma_invoices(id) on delete set null;

-- ============================================================
-- 5. Invoice payments (supports partial payments)
-- ============================================================

create table if not exists invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount numeric(14,2) not null,
  payment_date date not null default current_date,
  payment_method text,
  reference text,
  recorded_by text,
  notes text,
  created_at timestamp with time zone not null default now()
);

-- ============================================================
-- 6. Expenses
-- ============================================================

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  expense_number text not null unique,
  category text not null,
  description text not null,
  vendor text,
  amount numeric(14,2) not null,
  currency text not null default 'TZS',
  expense_date date not null default current_date,
  payment_method text,
  reference text,
  receipt_reference text,
  department text,
  status text not null default 'draft',
  created_by text,
  approved_by text,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table expenses
  add constraint expenses_status_check check (status in (
    'draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'paid', 'cancelled'
  ));

create trigger expenses_set_updated_at
  before update on expenses
  for each row
  execute function set_updated_at();

-- ============================================================
-- 7. Permissions: grant the finance permission set to cfo (full) and ceo
--    (view + approve, per the CEO authority model — broad visibility and
--    approval power, but not day-to-day finance operations).
-- ============================================================

insert into role_permissions (role_id, permission_id) values
  ('cfo', 'dashboard.finance.view'),
  ('cfo', 'proformas.view'), ('cfo', 'proformas.create'), ('cfo', 'proformas.update'),
  ('cfo', 'proformas.approve'), ('cfo', 'proformas.convert'),
  ('cfo', 'invoices.view'), ('cfo', 'invoices.create'), ('cfo', 'invoices.update'),
  ('cfo', 'invoices.issue'), ('cfo', 'invoices.record_payment'), ('cfo', 'invoices.cancel'),
  ('cfo', 'expenses.view'), ('cfo', 'expenses.create'), ('cfo', 'expenses.approve'), ('cfo', 'expenses.reject'),
  ('cfo', 'finance.reports.view'), ('cfo', 'finance.reports.export'),

  ('ceo', 'dashboard.finance.view'),
  ('ceo', 'proformas.view'), ('ceo', 'proformas.approve'),
  ('ceo', 'invoices.view'),
  ('ceo', 'expenses.view'), ('ceo', 'expenses.approve'),
  ('ceo', 'finance.reports.view'), ('ceo', 'finance.reports.export')
on conflict do nothing;

-- ============================================================
-- 8. RLS
-- ============================================================

alter table proforma_invoices enable row level security;
create policy "proformas.view can select proformas" on proforma_invoices for select to authenticated using (has_permission('proformas.view'));
create policy "proformas.create can insert proformas" on proforma_invoices for insert to authenticated with check (has_permission('proformas.create'));
create policy "proformas can be updated by authorized roles" on proforma_invoices for update to authenticated
  using (has_permission('proformas.update') or has_permission('proformas.approve') or has_permission('proformas.convert'))
  with check (has_permission('proformas.update') or has_permission('proformas.approve') or has_permission('proformas.convert'));

alter table invoices enable row level security;
create policy "invoices.view can select invoices" on invoices for select to authenticated using (has_permission('invoices.view'));
create policy "invoices.create can insert invoices" on invoices for insert to authenticated with check (has_permission('invoices.create'));
create policy "invoices can be updated by authorized roles" on invoices for update to authenticated
  using (has_permission('invoices.update') or has_permission('invoices.issue') or has_permission('invoices.record_payment') or has_permission('invoices.cancel'))
  with check (has_permission('invoices.update') or has_permission('invoices.issue') or has_permission('invoices.record_payment') or has_permission('invoices.cancel'));

alter table invoice_payments enable row level security;
create policy "invoices.view can select payments" on invoice_payments for select to authenticated using (has_permission('invoices.view'));
create policy "invoices.record_payment can insert payments" on invoice_payments for insert to authenticated with check (has_permission('invoices.record_payment'));

alter table expenses enable row level security;
create policy "expenses.view can select expenses" on expenses for select to authenticated using (has_permission('expenses.view'));
create policy "expenses.create can insert expenses" on expenses for insert to authenticated with check (has_permission('expenses.create'));
create policy "expenses can be updated by authorized roles" on expenses for update to authenticated
  using (has_permission('expenses.create') or has_permission('expenses.approve') or has_permission('expenses.reject'))
  with check (has_permission('expenses.create') or has_permission('expenses.approve') or has_permission('expenses.reject'));
