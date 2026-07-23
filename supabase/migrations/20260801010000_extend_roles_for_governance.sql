-- Governance: Roles & Permissions gets real role lifecycle management
-- (create/clone/edit/activate/deactivate) on top of the permission matrix
-- that already existed. roles.manage already gates all of insert/update/
-- delete on `roles` (seeded in the RBAC foundation) — no new permission is
-- needed for role CRUD, only the is_active column and its enforcement.

alter table roles add column if not exists is_active boolean not null default true;

-- has_permission() now also requires the STAFF MEMBER'S role to be active —
-- a deactivated role grants nothing, even though its role_permissions rows
-- are left in place (deactivating is reversible without re-building the
-- permission set). super_admin's own row can never be deactivated (see the
-- trigger below), so this can't lock out the last admin.
create or replace function has_permission(perm_key text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from staff_profiles sp
    join roles r on r.id = sp.role
    join role_permissions rp on rp.role_id = sp.role
    where sp.user_id = auth.uid()
      and sp.is_active = true
      and r.is_active = true
      and rp.permission_id = perm_key
  );
$$;

-- Defense in depth for "Protect default roles": the 8 seeded roles
-- (is_system = true) can never be renamed, deactivated, or deleted via this
-- trigger, regardless of what the app layer does — mirrors
-- protect_staff_role_changes()'s belt-and-suspenders approach for
-- staff_profiles. Permission GRANTS on system roles (other than
-- super_admin, which the app layer already blocks in
-- governance/roles/actions.ts) are still editable — only identity/liveness
-- is locked.
create or replace function protect_system_roles()
returns trigger as $$
begin
  if TG_OP = 'DELETE' then
    if old.is_system then
      raise exception 'System roles cannot be deleted';
    end if;
    return old;
  end if;

  if old.is_system and new.name is distinct from old.name then
    raise exception 'System roles cannot be renamed';
  end if;
  if old.is_system and new.is_active is distinct from old.is_active and new.is_active = false then
    raise exception 'System roles cannot be deactivated';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists roles_protect_system_roles on roles;
create trigger roles_protect_system_roles
  before update or delete on roles
  for each row
  execute function protect_system_roles();
