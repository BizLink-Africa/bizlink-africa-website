-- Adds the 2 fee categories Revenue Management needs that don't exist yet
-- (Consulting, Maintenance) alongside the 8 that already exist as fixed fee
-- columns on invoices/proforma_invoices. Mechanical copy of the existing
-- columns — same numeric(14,2), same default 0.

alter table invoices add column if not exists consulting_fee numeric(14,2) not null default 0;
alter table invoices add column if not exists maintenance_fee numeric(14,2) not null default 0;

alter table proforma_invoices add column if not exists consulting_fee numeric(14,2) not null default 0;
alter table proforma_invoices add column if not exists maintenance_fee numeric(14,2) not null default 0;
