-- Payments Received: adds the 2 fields the standalone payments ledger needs
-- that invoice_payments doesn't have yet (receipt_reference is distinct
-- from the existing `reference` — e.g. reference is the payer's bank/mobile
-- money transaction ID, receipt_reference is BizLink's own receipt number
-- issued back to the client; currency records what the payment was actually
-- made in, independent of the invoice's billing currency).
--
-- New payments.view permission for the read-only Payments Received page —
-- the write path keeps using the existing invoices.record_payment
-- permission via recordInvoicePayment(), unchanged.

alter table invoice_payments add column if not exists receipt_reference text;
alter table invoice_payments add column if not exists currency text;

update invoice_payments p
set currency = i.currency
from invoices i
where p.invoice_id = i.id and p.currency is null;

alter table invoice_payments alter column currency set default 'TZS';

insert into permissions (id, module, description) values
  ('payments.view', 'payments', 'View payments received')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'payments.view'),
  ('cfo', 'payments.view'),
  ('ceo', 'payments.view')
on conflict do nothing;
