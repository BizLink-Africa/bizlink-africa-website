-- Removes the "Preferred Settlement Destination" field entirely.
--
-- Asking prospective merchants to declare a settlement destination (bank
-- account / mobile wallet) directly to BizLink Africa conflicts with the
-- merchant-managed settlement model: BizLink does not handle settlement,
-- so it has no need to collect or store this preference. The public
-- /contact form no longer asks for it (see
-- src/app/(site)/contact/page.tsx and src/lib/validation/inquiry.ts), and
-- no admin screen ever displayed it. Confirmed via a live count query
-- before writing this migration that 0 of the 11 existing website_leads
-- rows had a non-null value in this column, so this drops no real data.

alter table website_leads
  drop constraint if exists website_leads_merchant_settlement_destination_check;

alter table website_leads
  drop column if exists merchant_settlement_destination;
