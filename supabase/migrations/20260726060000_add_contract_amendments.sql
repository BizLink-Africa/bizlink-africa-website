-- Contract Amendments: a log of changes made to an active/signed contract
-- that don't warrant moving it through the full draft->approval status
-- machine again. Kept as a separate append-style log rather than a new
-- contracts.status value, since "active"/"signed" already drive
-- computeExpiryFlag() and other status-based logic that an "amendment"
-- status would collide with.
--
-- Reuses existing contracts.update (log an amendment) / contracts.approve
-- (mark an amendment approved) / contracts.view (read) permissions — no new
-- permission keys needed.

create table if not exists contract_amendments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  description text not null,
  effective_date date,
  requested_by text,
  approved_by text,
  created_at timestamp with time zone not null default now()
);

alter table contract_amendments enable row level security;
create policy "contracts.view can select contract_amendments" on contract_amendments for select to authenticated using (has_permission('contracts.view'));
create policy "contracts.update can insert contract_amendments" on contract_amendments for insert to authenticated with check (has_permission('contracts.update'));
create policy "contracts.approve can mark contract_amendments approved" on contract_amendments for update to authenticated using (has_permission('contracts.approve')) with check (has_permission('contracts.approve'));
