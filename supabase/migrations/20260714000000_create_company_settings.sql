-- Singleton table backing the "Company Profile" and "Contact Details"
-- sections of the Super Admin Settings page — the only two sections of
-- that page with genuinely persistable, editable fields. The
-- `id boolean primary key default true check (id)` trick guarantees at
-- most one row can ever exist.

create table if not exists company_settings (
  id boolean primary key default true check (id),
  business_name text not null default 'BizLink Africa Limited',
  business_email text not null default 'info@bizlinkafrica.net',
  support_email text not null default 'support@bizlinkafrica.net',
  phone_whatsapp text not null default '+255 624 239 712',
  location text not null default 'Temboni, Ubungo, Dar es Salaam, Tanzania',
  updated_at timestamp with time zone not null default now()
);

insert into company_settings (id) values (true)
  on conflict (id) do nothing;

alter table company_settings enable row level security;

create policy "Authenticated can view company settings"
  on company_settings for select to authenticated using (true);
create policy "Authenticated can insert company settings"
  on company_settings for insert to authenticated with check (true);
create policy "Authenticated can update company settings"
  on company_settings for update to authenticated using (true) with check (true);

create trigger company_settings_set_updated_at
  before update on company_settings
  for each row
  execute function set_updated_at();
