-- Correction: the Compliance & Security "Policies"/"Policy Acknowledgements"
-- pages were initially built against a brand-new `policies` table, but a
-- Policies feature already existed at Governance > Policies
-- (`governance_policies`, gated by the same policies.view/policies.manage
-- permissions) — a genuine duplicate caught before shipping. Reconciles by
-- extending governance_policies with the two columns the Compliance spec
-- needs (file_url, acknowledgement_required) and repointing
-- policy_acknowledgements at it instead. The Compliance & Security sidebar's
-- "Policies" item now links directly to the existing Governance page rather
-- than duplicating it.

alter table governance_policies
  add column if not exists file_url text,
  add column if not exists acknowledgement_required boolean not null default false;

drop table if exists policy_acknowledgements;

create table policy_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references governance_policies(id) on delete cascade,
  staff_id uuid not null references staff_profiles(id) on delete cascade,
  acknowledged_at timestamp with time zone not null default now(),
  unique (policy_id, staff_id)
);

alter table policy_acknowledgements enable row level security;
create policy "policies.view can select policy_acknowledgements" on policy_acknowledgements for select to authenticated using (has_permission('policies.view'));
create policy "staff can acknowledge policies for themselves" on policy_acknowledgements for insert to authenticated
  with check (
    has_permission('policies.acknowledge')
    and staff_id in (select id from staff_profiles where user_id = auth.uid())
  );

drop table if exists policies;
