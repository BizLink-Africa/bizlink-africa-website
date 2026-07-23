-- Finance Settings: a dedicated permission pair, distinct from the generic
-- settings.manage used by the global Settings page (company identity
-- fields only). Gates a new page that edits the company_settings columns
-- that have existed since the finance module shipped but never had an
-- editable UI: vat_percentage, default_currency, invoice_prefix,
-- proforma_prefix, default_payment_terms_days, expense_high_value_threshold.

insert into permissions (id, module, description) values
  ('finance.settings.view', 'finance', 'View finance settings (VAT, currency, thresholds, numbering)'),
  ('finance.settings.manage', 'finance', 'Change finance settings (VAT, currency, thresholds, numbering)')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'finance.settings.view'), ('super_admin', 'finance.settings.manage'),
  ('cfo', 'finance.settings.view'), ('cfo', 'finance.settings.manage'),
  ('ceo', 'finance.settings.view')
on conflict do nothing;
