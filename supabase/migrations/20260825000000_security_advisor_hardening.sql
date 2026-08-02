-- Security hardening pass driven by Supabase's own Security Advisor
-- (run as an independent second check alongside this session's static
-- migration-file review — see docs/PRODUCTION_SECURITY_CHECKLIST.md's
-- existing note that a live Advisor run is recommended precisely because
-- a static read can miss anything applied out-of-band). Every change here
-- is either (a) a functional no-op that only tightens an already-safe
-- internal check into an explicit grant (defense in depth), or (b) a
-- genuine gap closed after verifying no legitimate current app code path
-- depends on the looser behaviour — each is individually justified below.

-- ── 1. website_leads: drop the unused, unvalidated direct-anon-insert
-- policy. ─────────────────────────────────────────────────────────────
-- REAL FINDING, not just hardening. This policy predates
-- src/app/api/inquiries/route.ts, which is the actual, current, ONLY
-- insert path the public contact form uses today — and it inserts via
-- createServiceClient() (the service-role key, which bypasses RLS
-- entirely), never via the anon-scoped client. Confirmed via a full
-- repo search: no app code anywhere calls
-- supabase.from('website_leads').insert(...) using an anon/browser
-- client. That means this `with check (true)` policy — completely
-- unvalidated, no rate limit, no honeypot check, no field validation —
-- is currently reachable ONLY by an attacker calling Supabase's REST API
-- directly with the public anon key (which is, by design, public
-- information shipped to every browser), bypassing every protection the
-- Next.js route implements. Dropping it is safe: the legitimate path
-- doesn't use it and never did once the API-route pattern was adopted.
drop policy if exists "Public can submit leads" on website_leads;

-- ── 2. Foundational predicate functions: explicit grants instead of the
-- implicit PUBLIC-execute default. ──────────────────────────────────────
-- has_permission()/is_active_staff()/is_super_admin() are called from
-- inside RLS policies across virtually every table in this database, so
-- `authenticated` MUST keep EXECUTE — these three statements
-- (revoke public, grant authenticated, explicit revoke anon) preserve
-- exactly that while removing the implicit "anyone, including anon" grant
-- Postgres gives new functions by default. Purely a hardening step: each
-- function already independently resolves to a safe value (false /
-- exception) for an unauthenticated caller, since they all key off
-- auth.uid(), which is null for anon. No behaviour change for any
-- legitimate caller.
revoke execute on function has_permission(text) from public;
grant execute on function has_permission(text) to authenticated;
revoke execute on function has_permission(text) from anon;

revoke execute on function is_active_staff() from public;
grant execute on function is_active_staff() to authenticated;
revoke execute on function is_active_staff() from anon;

revoke execute on function is_super_admin() from public;
grant execute on function is_super_admin() to authenticated;
revoke execute on function is_super_admin() from anon;

-- ── 3. insert_provisioning_credential(): already internally gated by
-- has_permission('provisioning.manage') — an anon call already fails
-- safely today. Explicit grants added anyway as defense in depth, so a
-- future edit to this function's body can never accidentally drop the
-- internal check without the anon/public EXECUTE grant also having to be
-- explicitly reinstated first. ───────────────────────────────────────────
revoke execute on function insert_provisioning_credential(uuid, text, text, text, text, text) from public;
grant execute on function insert_provisioning_credential(uuid, text, text, text, text, text) to authenticated;
revoke execute on function insert_provisioning_credential(uuid, text, text, text, text, text) from anon;

-- ── 4. next_finance_number(): REAL FINDING. Unlike every other
-- SECURITY DEFINER function in this codebase, this one has NO internal
-- has_permission() check at all — it was reachable, unauthenticated, by
-- anyone with the public anon key via
-- POST /rest/v1/rpc/next_finance_number, letting an anonymous caller
-- burn through/skip BizLink's sequential invoice/payout/client numbering
-- (PAY-2026-NNNN etc.) at will. Every legitimate call site
-- (src/app/admin/(protected)/actions.ts's convertLeadToClient() and
-- others) already runs under an authenticated staff session gated by its
-- own specific permission (leads.convert, etc.) — this function itself
-- doesn't need a NEW internal permission check, it just needs the
-- unauthenticated path closed. ────────────────────────────────────────
revoke execute on function next_finance_number(text) from public;
grant execute on function next_finance_number(text) to authenticated;
revoke execute on function next_finance_number(text) from anon;

-- ── 5. Trigger-only functions: never meant to be called directly via
-- RPC at all (they run automatically as BEFORE UPDATE/DELETE triggers,
-- which doesn't require the querying role to hold EXECUTE on them) — so
-- no `grant ... to authenticated` is needed, only closing the
-- unauthenticated direct-call surface. ──────────────────────────────────
revoke execute on function protect_staff_role_changes() from public;
revoke execute on function protect_staff_role_changes() from anon;

revoke execute on function protect_system_roles() from public;
revoke execute on function protect_system_roles() from anon;

-- ── 6. set_updated_at(): add the explicit search_path every other
-- SECURITY DEFINER/trigger function in this codebase already sets, for
-- consistency and to close the (here, low-severity — the function body
-- references no unqualified table/function names) search_path-mutable
-- finding. Not SECURITY DEFINER, so this is float-level hardening rather
-- than a real privilege-escalation fix, but zero-risk to apply. ─────────
create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
