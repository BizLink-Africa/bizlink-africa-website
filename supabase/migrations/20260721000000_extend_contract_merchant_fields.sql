-- Adds the remaining fields from the merchant/agent onboarding template not
-- already captured. Same two-tier split as before: safe business-profile
-- facts go on `contracts`; anything identification/licensing/financial
-- stays in `contract_sensitive_details`, gated by contracts.sensitive.view
-- / contracts.sensitive.manage.

-- Safe tier (contracts.view)
alter table contracts add column if not exists merchant_agent_name text;
alter table contracts add column if not exists business_registration_number text;
alter table contracts add column if not exists main_products_or_services text;

-- Sensitive tier (contracts.sensitive.view / .manage)
alter table contract_sensitive_details add column if not exists business_licence_number text;
alter table contract_sensitive_details add column if not exists business_licence_expiry_date date;
alter table contract_sensitive_details add column if not exists mobile_money_providers text;
alter table contract_sensitive_details add column if not exists pos_provider_name text;
