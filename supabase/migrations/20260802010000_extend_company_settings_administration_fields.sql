-- Administration settings pages: every new single-value setting is another
-- column on the existing company_settings singleton, same convention every
-- prior module used (Finance/Technology/Compliance all did this — see
-- company_settings' migration history). Multi-row catalogs (ticket
-- categories, escalation rules, campaign categories, lead sources,
-- deployment environments, required documents) get their own tables in the
-- next migration instead, following support_sla_rules' precedent.

alter table company_settings
  -- Company Settings: logo, registration/tax identity, branding
  add column if not exists logo_url text,
  add column if not exists business_registration_number text,
  add column if not exists tax_identification_number text,
  add column if not exists brand_primary_color text not null default '#00342b',
  add column if not exists brand_secondary_color text not null default '#004d40',

  -- Finance Settings: financial year (everything else Finance needs
  -- already existed — default_currency/vat_percentage/invoice_prefix/
  -- proforma_prefix/default_payment_terms_days/expense_high_value_threshold)
  add column if not exists financial_year_start_month integer not null default 1,

  -- Contract Settings
  add column if not exists contract_prefix text not null default 'CTR',
  add column if not exists contract_renewal_notice_days integer not null default 30,
  add column if not exists contract_expiry_notice_days integer not null default 14,
  add column if not exists contract_required_approval_roles text[] not null default array['ceo'],

  -- Marketing Settings (categories/lead-sources are catalog tables, not here)
  add column if not exists marketing_default_channels text[] not null default array['email', 'social_media'],
  add column if not exists marketing_reporting_preference text not null default 'monthly',

  -- Technology Settings additions (uptime_target_percentage/
  -- api_response_time_target_ms/incident_alert_email/maintenance_mode
  -- already existed)
  add column if not exists technology_monitoring_interval_minutes integer not null default 15,
  add column if not exists technology_logs_retention_days integer not null default 90,
  add column if not exists technology_backups_retention_days integer not null default 30,

  -- Compliance Settings
  add column if not exists compliance_review_frequency_days integer not null default 90,
  add column if not exists compliance_policy_review_period_days integer not null default 365,

  -- Security Settings — password policy, MFA, session/login limits.
  -- IP restrictions are stored but NOT actively enforced anywhere (no
  -- middleware reads security_ip_allowlist) — same "configured, not
  -- wired to real enforcement" honesty as Session Monitoring. Login
  -- limits/lockout ARE actively enforced (see login/actions.ts).
  add column if not exists security_password_min_length integer not null default 8,
  add column if not exists security_password_require_uppercase boolean not null default true,
  add column if not exists security_password_require_number boolean not null default true,
  add column if not exists security_password_require_symbol boolean not null default false,
  add column if not exists security_mfa_required boolean not null default false,
  add column if not exists security_session_timeout_minutes integer not null default 60,
  add column if not exists security_max_login_attempts integer not null default 5,
  add column if not exists security_lockout_duration_minutes integer not null default 15,
  add column if not exists security_ip_allowlist text,
  add column if not exists security_data_retention_days integer not null default 365,

  -- Email Settings. Never a raw credential — RESEND_API_KEY stays an env
  -- var, shown only as configured/not (see Email Settings page).
  add column if not exists email_sender_name text not null default 'BizLink Africa',
  add column if not exists email_sender_address text,
  add column if not exists email_proforma_enabled boolean not null default true,
  add column if not exists email_invoice_enabled boolean not null default true,
  add column if not exists email_contract_enabled boolean not null default true,
  add column if not exists email_support_enabled boolean not null default true,

  -- Notification Settings (the in-app notification center's own config,
  -- distinct from Email Settings)
  add column if not exists notifications_broadcast_enabled boolean not null default true,
  add column if not exists notifications_default_priority text not null default 'normal',

  -- System Settings. default_currency (Finance) and maintenance_mode
  -- (Technology) are intentionally NOT duplicated here — System Settings
  -- displays/edits those same columns rather than adding new ones.
  add column if not exists system_timezone text not null default 'Africa/Dar_es_Salaam',
  add column if not exists system_language text not null default 'en',
  add column if not exists system_file_storage_notes text;

alter table company_settings
  add constraint company_settings_financial_year_start_month_check check (financial_year_start_month between 1 and 12),
  add constraint company_settings_marketing_reporting_preference_check check (marketing_reporting_preference in ('weekly', 'monthly', 'quarterly')),
  add constraint company_settings_security_password_min_length_check check (security_password_min_length >= 6),
  add constraint company_settings_notifications_default_priority_check check (notifications_default_priority in ('low', 'normal', 'high', 'urgent'));
