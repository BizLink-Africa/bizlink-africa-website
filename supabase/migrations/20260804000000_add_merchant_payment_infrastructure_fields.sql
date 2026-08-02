-- Adds preliminary, non-sensitive Merchant Payment Infrastructure
-- application fields to website_leads, collected only when a public
-- inquiry selects the "Merchant Payment Infrastructure" solution.
--
-- These capture business-classification and preference information only —
-- no bank account numbers, mobile-wallet numbers, or KYC documents are ever
-- collected on the public form. Sensitive onboarding data collection
-- happens later through a protected, non-public workflow once BizLink
-- Africa and the approved payment infrastructure partner have reviewed the
-- inquiry.

alter table website_leads
  add column if not exists merchant_business_registration_status text,
  add column if not exists merchant_business_type text,
  add column if not exists merchant_monthly_volume_range text,
  add column if not exists merchant_settlement_destination text,
  add column if not exists merchant_current_collection_method text,
  add column if not exists merchant_business_locations_count integer,
  add column if not exists merchant_golive_timeline text,
  add column if not exists merchant_accuracy_confirmed boolean not null default false;

alter table website_leads
  drop constraint if exists website_leads_merchant_registration_status_check;
alter table website_leads
  add constraint website_leads_merchant_registration_status_check check (
    merchant_business_registration_status is null or merchant_business_registration_status in (
      'registered', 'in_process', 'not_registered'
    )
  );

alter table website_leads
  drop constraint if exists website_leads_merchant_business_type_check;
alter table website_leads
  add constraint website_leads_merchant_business_type_check check (
    merchant_business_type is null or merchant_business_type in (
      'retail', 'ecommerce', 'service_provider', 'restaurant_food', 'wholesale_distribution', 'other'
    )
  );

alter table website_leads
  drop constraint if exists website_leads_merchant_volume_range_check;
alter table website_leads
  add constraint website_leads_merchant_volume_range_check check (
    merchant_monthly_volume_range is null or merchant_monthly_volume_range in (
      'under_5m', '5m_20m', '20m_50m', '50m_200m', 'above_200m'
    )
  );

alter table website_leads
  drop constraint if exists website_leads_merchant_settlement_destination_check;
alter table website_leads
  add constraint website_leads_merchant_settlement_destination_check check (
    merchant_settlement_destination is null or merchant_settlement_destination in (
      'bank_account', 'mobile_wallet', 'not_decided'
    )
  );

alter table website_leads
  drop constraint if exists website_leads_merchant_collection_method_check;
alter table website_leads
  add constraint website_leads_merchant_collection_method_check check (
    merchant_current_collection_method is null or merchant_current_collection_method in (
      'cash_only', 'mobile_money_manual', 'bank_transfer', 'existing_gateway', 'mixed_multiple', 'none_yet'
    )
  );

alter table website_leads
  drop constraint if exists website_leads_merchant_golive_timeline_check;
alter table website_leads
  add constraint website_leads_merchant_golive_timeline_check check (
    merchant_golive_timeline is null or merchant_golive_timeline in (
      'immediately', 'within_1_month', '1_3_months', '3_6_months', 'not_sure'
    )
  );

alter table website_leads
  drop constraint if exists website_leads_merchant_locations_count_check;
alter table website_leads
  add constraint website_leads_merchant_locations_count_check check (
    merchant_business_locations_count is null or merchant_business_locations_count between 1 and 100000
  );

-- No RLS changes needed: the existing "Public can submit leads" insert
-- policy on website_leads is row-level (with check (true)), not
-- column-restricted, so it already covers these new columns. Reads/updates
-- remain restricted to authenticated (admin) and service-role clients.
