-- Line items: itemized quantity x unit price breakdown per document,
-- grouped by the same 10 categories as the fixed fee columns. The app
-- layer sums each document's line items by category and writes those sums
-- into the existing setup_fee/implementation_fee/.../consulting_fee/
-- maintenance_fee columns at save time (see proformas/invoices actions.ts)
-- — computeTotals(), the fee breakdown table, and convertProformaToInvoice()
-- all keep working completely unchanged. Line items are the detailed
-- "how we got this category total" record, not a second source of truth
-- for the total itself.
--
-- No new permissions: these are just detail rows on documents that already
-- have permission-gated access via proformas.*/invoices.*.

create table if not exists proforma_line_items (
  id uuid primary key default gen_random_uuid(),
  proforma_id uuid not null references proforma_invoices(id) on delete cascade,
  category text not null,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  created_at timestamp with time zone not null default now()
);

alter table proforma_line_items
  add constraint proforma_line_items_category_check check (category in (
    'setup_fee', 'implementation_fee', 'ai_automation_fee', 'social_commerce_fee',
    'api_integration_fee', 'subscription_fee', 'support_fee', 'consulting_fee',
    'maintenance_fee', 'other_charges'
  ));

alter table proforma_line_items enable row level security;
create policy "proformas.view can select proforma_line_items" on proforma_line_items for select to authenticated using (has_permission('proformas.view'));
create policy "proformas.create can insert proforma_line_items" on proforma_line_items for insert to authenticated with check (has_permission('proformas.create'));
create policy "proformas.update can modify proforma_line_items" on proforma_line_items for update to authenticated using (has_permission('proformas.update')) with check (has_permission('proformas.update'));
create policy "proformas.update can delete proforma_line_items" on proforma_line_items for delete to authenticated using (has_permission('proformas.update'));

create table if not exists invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  category text not null,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  created_at timestamp with time zone not null default now()
);

alter table invoice_line_items
  add constraint invoice_line_items_category_check check (category in (
    'setup_fee', 'implementation_fee', 'ai_automation_fee', 'social_commerce_fee',
    'api_integration_fee', 'subscription_fee', 'support_fee', 'consulting_fee',
    'maintenance_fee', 'other_charges'
  ));

alter table invoice_line_items enable row level security;
create policy "invoices.view can select invoice_line_items" on invoice_line_items for select to authenticated using (has_permission('invoices.view'));
create policy "invoices.create can insert invoice_line_items" on invoice_line_items for insert to authenticated with check (has_permission('invoices.create'));
create policy "invoices.update can modify invoice_line_items" on invoice_line_items for update to authenticated using (has_permission('invoices.update')) with check (has_permission('invoices.update'));
create policy "invoices.update can delete invoice_line_items" on invoice_line_items for delete to authenticated using (has_permission('invoices.update'));
