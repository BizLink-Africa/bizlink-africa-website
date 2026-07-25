-- Updates the company support/WhatsApp number to the new official BizLink
-- Africa contact number. Only the default and the existing singleton row
-- are touched — see 20260714000000_create_company_settings.sql for the
-- table this backs (Super Admin "Company Settings" page).

alter table company_settings
  alter column phone_whatsapp set default '+255 747 730 270';

update company_settings
  set phone_whatsapp = '+255 747 730 270'
  where id = true;
