-- support_ticket_messages had no internal/client-visible distinction at
-- all — is_internal is the actual privacy boundary the Customer
-- Conversations page and the ticket detail thread both key off. Attachments
-- get their own child table + private Storage bucket, same pattern as
-- contract_versions/proposal_versions + their buckets.

alter table support_ticket_messages add column if not exists is_internal boolean not null default false;
alter table support_ticket_messages add column if not exists staff_user_id uuid references staff_profiles(id) on delete set null;

create table if not exists support_ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references support_ticket_messages(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  uploaded_by text,
  created_at timestamp with time zone not null default now()
);

alter table support_ticket_attachments enable row level security;
create policy "tickets.view can select support_ticket_attachments" on support_ticket_attachments for select to authenticated using (has_permission('tickets.view'));
create policy "tickets.update can insert support_ticket_attachments" on support_ticket_attachments for insert to authenticated with check (has_permission('tickets.update'));

insert into storage.buckets (id, name, public)
values ('support-attachments', 'support-attachments', false)
on conflict (id) do nothing;

create policy "tickets.view can read support attachments"
  on storage.objects for select to authenticated
  using (bucket_id = 'support-attachments' and has_permission('tickets.view'));

create policy "tickets.update can upload support attachments"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'support-attachments' and has_permission('tickets.update'));
