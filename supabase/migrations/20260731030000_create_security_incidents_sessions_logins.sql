-- Security Incidents (+ timeline), Session Monitoring, Login Monitoring.
--
-- user_sessions is an app-tracked record of sessions security staff are
-- aware of (device/IP/login time) — this app has no access to Supabase
-- Auth's internal auth.sessions table via the exposed API, and the GoTrue
-- admin API's signOut() takes a raw access-token JWT, not a user id, so
-- there is no safe way to programmatically kill a specific real session
-- without storing a raw session token somewhere — which would itself be the
-- exact plaintext-secret exposure this module is required to prevent.
-- "Revoke Session" is therefore a real, permission-gated, audit-logged
-- workflow action on this tracked record (revoked/revoked_by/revoked_at),
-- same pattern as Technology's rollbackDeployment/retryBackgroundJob.
--
-- login_events IS real, live data: recordLoginEvent() (called from the
-- actual login page after every signInWithPassword attempt) inserts here
-- using the service-role client, which is why there is no insert policy at
-- all below — nothing using the anon or authenticated role key can write to
-- this table, only the service role (which bypasses RLS entirely).

create table if not exists security_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_number text unique,
  title text not null,
  severity text not null,
  status text not null default 'open',
  affected_systems text[] not null default '{}',
  affected_users text[] not null default '{}',
  detection_date date not null default current_date,
  owner text,
  containment text,
  resolution text,
  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  resolved_at timestamp with time zone
);
alter table security_incidents
  add constraint security_incidents_severity_check check (severity in ('low', 'medium', 'high', 'critical'));
alter table security_incidents
  add constraint security_incidents_status_check check (status in ('open', 'investigating', 'contained', 'resolved'));

create trigger security_incidents_set_updated_at before update on security_incidents for each row execute function set_updated_at();

alter table security_incidents enable row level security;
create policy "security_incidents.view can select security_incidents" on security_incidents for select to authenticated using (has_permission('security_incidents.view'));
create policy "security_incidents.manage can insert security_incidents" on security_incidents for insert to authenticated with check (has_permission('security_incidents.manage'));
create policy "security_incidents.manage can update security_incidents" on security_incidents for update to authenticated using (has_permission('security_incidents.manage')) with check (has_permission('security_incidents.manage'));


create table if not exists security_incident_updates (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references security_incidents(id) on delete cascade,
  note text not null,
  status_at_update text,
  created_by text,
  created_at timestamp with time zone not null default now()
);

alter table security_incident_updates enable row level security;
create policy "security_incidents.view can select security_incident_updates" on security_incident_updates for select to authenticated using (has_permission('security_incidents.view'));
create policy "security_incidents.manage can insert security_incident_updates" on security_incident_updates for insert to authenticated with check (has_permission('security_incidents.manage'));
-- Deliberately no update/delete policy — timeline entries are append-only, like audit_logs.


create table if not exists user_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff_profiles(id) on delete cascade,
  device text,
  ip_address text,
  login_at timestamp with time zone not null default now(),
  last_active_at timestamp with time zone not null default now(),
  revoked boolean not null default false,
  revoked_by text,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

alter table user_sessions enable row level security;
create policy "sessions.view can select user_sessions" on user_sessions for select to authenticated using (has_permission('sessions.view'));
create policy "sessions.manage can insert user_sessions" on user_sessions for insert to authenticated with check (has_permission('sessions.manage'));
create policy "sessions.manage can update user_sessions" on user_sessions for update to authenticated using (has_permission('sessions.manage')) with check (has_permission('sessions.manage'));


create table if not exists login_events (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  success boolean not null,
  ip_address text,
  user_agent text,
  failure_reason text,
  occurred_at timestamp with time zone not null default now()
);

alter table login_events enable row level security;
create policy "logins.view can select login_events" on login_events for select to authenticated using (has_permission('logins.view'));
-- No insert policy for anon/authenticated — see header comment. Service-role
-- inserts bypass RLS entirely.
