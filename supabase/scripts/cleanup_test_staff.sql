-- ============================================================================
-- BizLink Africa — Test Staff Account Cleanup
-- ============================================================================
--
-- NOT a migration. Do not put this in supabase/migrations/ and do not let it
-- run automatically as part of any deploy/migration pipeline — it is an
-- operational script, run manually and deliberately, once, against a real
-- environment, by someone who has read this whole file first.
--
-- WHY THIS SCRIPT LOOKS THE WAY IT DOES
-- --------------------------------------
-- This schema has no `is_test` flag or any other first-class marker
-- distinguishing test/demo staff from real production staff (confirmed by
-- auditing every migration — staff_profiles is schema-only; nothing seeds
-- staff rows). So "which accounts are test accounts" can only be answered by
-- a heuristic against staff_profiles.email / staff_profiles.full_name below
-- — never by role name alone, and never by department-style email alone
-- (a real ceo@/cfo@/operations@bizlinkafrica.net account is NOT matched by
-- this heuristic and must be confirmed by a human, not this script).
--
-- Rather than hand-listing every table that has a foreign key to
-- staff_profiles (which risks silently missing one, and will only get more
-- wrong as new modules are added), Section 2 discovers those foreign keys
-- from the actual live schema (pg_constraint) at run time and only acts on
-- what it finds — nullable FK columns get nulled, NOT NULL FK columns are
-- reported as needing a manual decision (a NOT NULL column can't be "safely"
-- auto-nulled — reassigning it means picking a real record owner, which is
-- a business decision, not something this script should guess at).
--
-- HOW TO USE THIS FILE
-- ---------------------
-- 1. Run SECTION 1 (dry run) by itself first. It is 100% read-only — it
--    changes nothing. Read every NOTICE it prints.
-- 2. Do not proceed to SECTION 2 until:
--      a. You have manually reviewed the candidate list and confirmed each
--         one really is a test/demo account, not a real staff member.
--      b. You have confirmed a recent Supabase backup/PITR checkpoint
--         exists (see docs/BACKUP_AND_RECOVERY.md).
-- 3. SECTION 2 refuses to run unless BOTH confirmation flags below are set,
--    in the same session, to the exact literal values shown — this is
--    deliberately not a single "are you sure? y/n" prompt, since this is a
--    SQL script with no interactive input; two distinct explicit
--    `set_config` calls are the closest equivalent achievable in pure SQL.
-- 4. Run SECTION 3 (post-cleanup verification) afterwards and confirm every
--    check passes.
--
-- ============================================================================


-- ============================================================================
-- SECTION 1 — DRY RUN (read-only, safe to run any time)
-- ============================================================================

-- 1a. Candidate test staff_profiles rows.
--
-- Matches, case-insensitively: the literal example.com domain, the specific
-- "verify.comp"/"verify.ops" fragments and "Test Account"-style names named
-- in the deployment brief, a generic "test"/"demo"/"fixture"/"sample"
-- marker in the name or local-part, and a "+test@" plus-addressing pattern.
-- Deliberately does NOT match on role, department, or any bizlinkafrica.net
-- address by itself.
select
  id,
  user_id,
  full_name,
  email,
  role,
  is_active,
  created_at
from staff_profiles
where
  email ilike '%@example.com'
  or email ilike '%verify.comp%'
  or email ilike '%verify.ops%'
  or email ilike 'test@%'
  or email ilike '%.test@%'
  or email ilike '%+test@%'
  or full_name ilike '%test account%'
  or full_name ilike '%verify%'
  or full_name ilike '% demo %'
  or full_name ilike 'demo %'
  or full_name ilike '% (test)%'
  or full_name ilike '%fixture%'
  or full_name ilike '%sample data%'
order by created_at;

-- 1b. For every candidate above, print how many rows in every other table
-- reference them via a foreign key to staff_profiles(id) or auth.users(id)
-- — this is the actual blast radius, discovered from the live schema
-- rather than a hand-maintained list that could be wrong or incomplete.
do $$
declare
  candidate record;
  fk record;
  affected_count bigint;
begin
  raise notice '--- Foreign-key blast radius per candidate (dry run — nothing modified) ---';

  for candidate in
    select id, user_id, email
    from staff_profiles
    where
      email ilike '%@example.com'
      or email ilike '%verify.comp%'
      or email ilike '%verify.ops%'
      or email ilike 'test@%'
      or email ilike '%.test@%'
      or email ilike '%+test@%'
      or full_name ilike '%test account%'
      or full_name ilike '%verify%'
      or full_name ilike '% demo %'
      or full_name ilike 'demo %'
      or full_name ilike '% (test)%'
      or full_name ilike '%fixture%'
      or full_name ilike '%sample data%'
  loop
    raise notice 'Candidate: % (staff_profiles.id=%, auth user id=%)', candidate.email, candidate.id, candidate.user_id;

    -- Every FK column, anywhere in the public schema, pointing at
    -- staff_profiles(id) or auth.users(id) — covers both id spaces, since
    -- a candidate has two distinct identifiers (its own staff_profiles.id,
    -- and staff_profiles.user_id which equals the auth.users.id it's tied to).
    for fk in
      select
        con.conrelid::regclass::text as referencing_table,
        att.attname as referencing_column,
        att.attnotnull as is_not_null,
        case when confrel.relname = 'staff_profiles' then candidate.id else candidate.user_id end as lookup_id
      from pg_constraint con
      join pg_class confrel on confrel.oid = con.confrelid
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
      where con.contype = 'f'
        and (
          (confrel.relname = 'staff_profiles' and con.confkey = array[(select attnum from pg_attribute where attrelid = 'staff_profiles'::regclass and attname = 'id')])
          or (confrel.relnamespace = 'auth'::regnamespace and confrel.relname = 'users')
        )
        and array_length(con.conkey, 1) = 1 -- composite FKs (rare) are skipped entirely; review pg_constraint by hand if any reference staff_profiles/auth.users
    loop
      execute format('select count(*) from %s where %I = $1', fk.referencing_table, fk.referencing_column)
        into affected_count
        using fk.lookup_id;

      if affected_count > 0 then
        raise notice '  % rows in %.% (nullable: %)', affected_count, fk.referencing_table, fk.referencing_column, not fk.is_not_null;
      end if;
    end loop;
  end loop;

  raise notice '--- End of dry-run report ---';
end $$;


-- ============================================================================
-- SECTION 2 — DESTRUCTIVE CLEANUP (does nothing unless BOTH lines below
-- are run first, in the same session, with these exact values)
-- ============================================================================
--
--   select set_config('bizlink.cleanup_confirmed', 'yes-delete-test-accounts', false);
--   select set_config('bizlink.cleanup_backup_confirmed', 'yes-recent-backup-exists', false);
--
-- Anything else (unset, misspelled, wrong session) makes the block below
-- raise an exception and roll back before touching a single row.

do $$
declare
  candidate record;
  fk record;
  active_super_admins_outside_candidates int;
  total_active_super_admins int;
  rows_nulled bigint;
  notifications_deleted bigint;
begin
  if current_setting('bizlink.cleanup_confirmed', true) is distinct from 'yes-delete-test-accounts' then
    raise exception 'Cleanup not confirmed. Run: select set_config(''bizlink.cleanup_confirmed'', ''yes-delete-test-accounts'', false);';
  end if;

  if current_setting('bizlink.cleanup_backup_confirmed', true) is distinct from 'yes-recent-backup-exists' then
    raise exception 'Backup not confirmed. Verify a recent backup/PITR checkpoint exists (see docs/BACKUP_AND_RECOVERY.md), then run: select set_config(''bizlink.cleanup_backup_confirmed'', ''yes-recent-backup-exists'', false);';
  end if;

  -- Final-super-admin guard: refuse to deactivate a single candidate if
  -- doing so would leave zero active super_admin staff. Checked against the
  -- CANDIDATE SET as a whole, not one at a time, since deactivating several
  -- candidates in the same run could otherwise each individually "look"
  -- safe while collectively wiping out every super_admin.
  select count(*) into total_active_super_admins
  from staff_profiles where role = 'super_admin' and is_active = true;

  select count(*) into active_super_admins_outside_candidates
  from staff_profiles
  where role = 'super_admin' and is_active = true
    and id not in (
      select id from staff_profiles
      where
        email ilike '%@example.com'
        or email ilike '%verify.comp%'
        or email ilike '%verify.ops%'
        or email ilike 'test@%'
        or email ilike '%.test@%'
        or email ilike '%+test@%'
        or full_name ilike '%test account%'
        or full_name ilike '%verify%'
        or full_name ilike '% demo %'
        or full_name ilike 'demo %'
        or full_name ilike '% (test)%'
        or full_name ilike '%fixture%'
        or full_name ilike '%sample data%'
    );

  if total_active_super_admins > 0 and active_super_admins_outside_candidates = 0 then
    raise exception 'Refusing to proceed: every active super_admin matches the test-account heuristic. This would leave zero active Super Admin users. Review the candidate list manually before continuing.';
  end if;

  for candidate in
    select id, user_id, email, full_name
    from staff_profiles
    where
      is_active = true
      and (
        email ilike '%@example.com'
        or email ilike '%verify.comp%'
        or email ilike '%verify.ops%'
        or email ilike 'test@%'
        or email ilike '%.test@%'
        or email ilike '%+test@%'
        or full_name ilike '%test account%'
        or full_name ilike '%verify%'
        or full_name ilike '% demo %'
        or full_name ilike 'demo %'
        or full_name ilike '% (test)%'
        or full_name ilike '%fixture%'
        or full_name ilike '%sample data%'
      )
  loop
    raise notice 'Cleaning up: % (%)', candidate.email, candidate.full_name;

    -- Null every nullable FK column referencing this candidate. NOT NULL FK
    -- columns are reported, not touched — reassigning them is a business
    -- decision this script won't guess at.
    for fk in
      select
        con.conrelid::regclass::text as referencing_table,
        att.attname as referencing_column,
        att.attnotnull as is_not_null,
        case when confrel.relname = 'staff_profiles' then candidate.id else candidate.user_id end as lookup_id
      from pg_constraint con
      join pg_class confrel on confrel.oid = con.confrelid
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
      where con.contype = 'f'
        and (
          (confrel.relname = 'staff_profiles' and con.confkey = array[(select attnum from pg_attribute where attrelid = 'staff_profiles'::regclass and attname = 'id')])
          or (confrel.relnamespace = 'auth'::regnamespace and confrel.relname = 'users')
        )
        and array_length(con.conkey, 1) = 1
    loop
      if fk.is_not_null then
        raise notice '  MANUAL ACTION REQUIRED: %.% is NOT NULL and references this account — reassign or resolve by hand before this candidate can be fully removed.', fk.referencing_table, fk.referencing_column;
        continue;
      end if;

      -- notifications-style tables are ephemeral, not business records —
      -- delete the rows outright rather than leaving orphaned notifications
      -- with a null recipient. Everything else (leads, tickets, contracts,
      -- projects, onboarding cases, tasks, campaigns, approvals, and any
      -- other join table) is a real business record: null the reference,
      -- keep the row.
      if fk.referencing_table ilike '%notification%' then
        execute format('delete from %s where %I = $1', fk.referencing_table, fk.referencing_column) using fk.lookup_id;
        get diagnostics notifications_deleted = row_count;
        if notifications_deleted > 0 then
          raise notice '  Deleted % row(s) from % (notification-style table)', notifications_deleted, fk.referencing_table;
        end if;
      else
        execute format('update %s set %I = null where %I = $1', fk.referencing_table, fk.referencing_column, fk.referencing_column) using fk.lookup_id;
        get diagnostics rows_nulled = row_count;
        if rows_nulled > 0 then
          raise notice '  Nulled % reference(s) in %.%', rows_nulled, fk.referencing_table, fk.referencing_column;
        end if;
      end if;
    end loop;

    -- Archive, don't hard-delete, the staff_profiles row itself — this
    -- reuses the exact same is_active flag every existing authorization
    -- check (is_active_staff(), requirePermission(), etc.) already gates
    -- on, and it means the existing protect_staff_role_changes() trigger
    -- (which fires on UPDATE, not DELETE — see the RLS audit) still applies
    -- as a safety net here, rather than routing around it via a hard
    -- DELETE the schema has no equivalent trigger protection for.
    update staff_profiles set is_active = false where id = candidate.id;
    raise notice '  Deactivated staff_profiles row (is_active = false).';
    raise notice '  Manual follow-up still required: remove/ban the corresponding auth.users account (id=%) via the Supabase Dashboard → Authentication → Users, or the Admin API — not done here, since that''s a GoTrue Admin API operation, not a plain table write.', candidate.user_id;
  end loop;

  raise notice '--- Cleanup complete. Run SECTION 3 to verify. ---';
end $$;


-- ============================================================================
-- SECTION 3 — POST-CLEANUP VERIFICATION (read-only)
-- ============================================================================

-- 3a. No active staff_profiles row should still match the test heuristic.
select count(*) as remaining_active_test_accounts
from staff_profiles
where
  is_active = true
  and (
    email ilike '%@example.com'
    or email ilike '%verify.comp%'
    or email ilike '%verify.ops%'
    or email ilike 'test@%'
    or email ilike '%.test@%'
    or email ilike '%+test@%'
    or full_name ilike '%test account%'
    or full_name ilike '%verify%'
    or full_name ilike '% demo %'
    or full_name ilike 'demo %'
    or full_name ilike '% (test)%'
    or full_name ilike '%fixture%'
    or full_name ilike '%sample data%'
  );
-- Expect: 0

-- 3b. At least one active Super Admin remains.
select count(*) as active_super_admins
from staff_profiles where role = 'super_admin' and is_active = true;
-- Expect: >= 1

-- 3c. All 8 required system roles remain, untouched.
select id, name, is_system
from roles
where id in ('super_admin', 'ceo', 'cfo', 'cto', 'operations', 'customer_support', 'marketing', 'compliance_security')
order by id;
-- Expect: 8 rows, every one with is_system = true

-- 3d. Any FK columns this run reported as "MANUAL ACTION REQUIRED" (NOT
-- NULL columns still referencing a now-deactivated test account) — rerun
-- the Section 1b query if unsure which candidates/columns those were.
