-- Policies, Policy Acknowledgements, Access Reviews.
--
-- access_reviews deliberately stores a point-in-time SNAPSHOT
-- (user_label/role_label/department/permissions_summary as plain text) of
-- what a reviewer saw, rather than live-joining staff_profiles/roles — a
-- review record describes what was true when it was reviewed, and must not
-- silently reinterpret itself if the person's role changes afterward. It
-- also never writes to roles/role_permissions/staff_profiles: an access
-- review is a documented recommendation, not a role mutation (that stays
-- gated behind roles.manage/users.manage on the Staff & Roles page, which
-- compliance_security does not hold).

create table if not exists policies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  version text not null default '1.0',
  owner text,
  effective_date date,
  review_date date,
  status text not null default 'draft',
  file_url text,
  acknowledgement_required boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
alter table policies
  add constraint policies_status_check check (status in ('draft', 'active', 'archived'));

create trigger policies_set_updated_at before update on policies for each row execute function set_updated_at();

alter table policies enable row level security;
create policy "policies.view can select policies" on policies for select to authenticated using (has_permission('policies.view'));
create policy "policies.manage can insert policies" on policies for insert to authenticated with check (has_permission('policies.manage'));
create policy "policies.manage can update policies" on policies for update to authenticated using (has_permission('policies.manage')) with check (has_permission('policies.manage'));


create table if not exists policy_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references policies(id) on delete cascade,
  staff_id uuid not null references staff_profiles(id) on delete cascade,
  acknowledged_at timestamp with time zone not null default now(),
  unique (policy_id, staff_id)
);

alter table policy_acknowledgements enable row level security;
create policy "policies.view can select policy_acknowledgements" on policy_acknowledgements for select to authenticated using (has_permission('policies.view'));
-- Any active staff member can acknowledge a policy for themselves — that's
-- the point of the feature — but only as themselves (with check below),
-- never on another staff member's behalf.
create policy "staff can acknowledge policies for themselves" on policy_acknowledgements for insert to authenticated
  with check (
    has_permission('policies.acknowledge')
    and staff_id in (select id from staff_profiles where user_id = auth.uid())
  );


create table if not exists access_reviews (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references staff_profiles(id) on delete set null,
  user_label text not null,
  role_label text,
  department text,
  permissions_summary text,
  reviewer text,
  findings text,
  excessive_access_flag boolean not null default false,
  decision text not null default 'pending',
  next_review_date date,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
alter table access_reviews
  add constraint access_reviews_decision_check check (decision in ('pending', 'approved', 'access_reduced_recommended', 'revoke_recommended'));

create trigger access_reviews_set_updated_at before update on access_reviews for each row execute function set_updated_at();

alter table access_reviews enable row level security;
create policy "access_reviews.view can select access_reviews" on access_reviews for select to authenticated using (has_permission('access_reviews.view'));
create policy "access_reviews.manage can insert access_reviews" on access_reviews for insert to authenticated with check (has_permission('access_reviews.manage'));
create policy "access_reviews.manage can update access_reviews" on access_reviews for update to authenticated using (has_permission('access_reviews.manage')) with check (has_permission('access_reviews.manage'));
