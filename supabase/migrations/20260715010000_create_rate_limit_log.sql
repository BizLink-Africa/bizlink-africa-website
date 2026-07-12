-- Backs simple rate limiting for the public /api/inquiries route (no auth
-- barrier exists there by design — it's the public contact form). Every
-- submission attempt (successful or rejected) logs one row keyed by client
-- IP; the route checks the count in the last window before inserting a lead.
--
-- RLS is enabled with NO policies at all — this table is only ever touched
-- by the service-role client (see src/lib/supabase/service.ts), which
-- bypasses RLS entirely. Locking it down by default means even the anon or
-- authenticated keys can never read or write it.

create table if not exists inquiry_submission_log (
  id uuid primary key default gen_random_uuid(),
  ip_address text not null,
  created_at timestamp with time zone not null default now()
);

create index if not exists inquiry_submission_log_ip_created_idx
  on inquiry_submission_log (ip_address, created_at);

alter table inquiry_submission_log enable row level security;

-- Deliberately no policies — service role only.
