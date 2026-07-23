# Backup and Recovery — BizLink Africa

**Status: unverified.** This document describes what to check and how to
test it — it does not itself confirm backups are working. Per the
production security spec this repo is being hardened against: *do not claim
backups are working until a restore procedure has actually been verified.*
Nothing in this file should be read as "backups are configured" until the
checklist below has been executed and its results recorded.

This session has no Supabase dashboard/CLI/MCP access, so the plan tier,
backup configuration, and PITR availability for the actual production
Supabase project could not be inspected directly. Everything below is what
to go check, not a confirmed state.

---

## 1. Supabase backup configuration — verify these in the dashboard

Go to **Supabase Dashboard → Project Settings → Database → Backups**
(exact location may vary by dashboard version) and record:

- [ ] Current plan tier (Free / Pro / Team / Enterprise) — backup
      frequency and retention differ significantly by tier.
- [ ] Whether **Point-in-Time Recovery (PITR)** is available and enabled.
      PITR is generally a paid-tier feature; on the Free tier, only daily
      logical backups with limited retention are typical — confirm the
      actual current entitlement rather than assuming either.
- [ ] Backup retention window (how many days back you can restore to).
- [ ] Whether backups cover Storage objects (`contract-files`,
      `support-attachments`, `proposal-files` — see the RLS/storage audit
      in the completion report) or only the Postgres database. Supabase
      Storage backup behavior differs from database backup behavior —
      verify both are actually covered, not just assumed.

## 2. SSL enforcement and network restrictions

- [ ] Confirm **Enforce SSL** is on for database connections (Database →
      Settings).
- [ ] If the project's plan supports **network restrictions** (IP
      allow-listing for direct Postgres connections), consider restricting
      direct database access to known infrastructure (Vercel's egress IPs
      are not static/predictable by default, so this mainly matters for
      direct `psql`/admin access, not the app's own Supabase client
      traffic, which goes through Supabase's API layer, not a direct
      Postgres connection).

## 3. Database Security Advisors

- [ ] Open **Supabase Dashboard → Advisors → Security Advisor** and review
      every finding. This tool checks for exactly the class of issue this
      hardening pass targets (tables without RLS, overly permissive
      policies, `security definer` functions without an explicit
      `search_path`, etc.) — cross-check its output against the findings in
      the completion report; the advisor has live access to the actual
      database schema, which this session did not.
- [ ] Open **Advisors → Performance Advisor** and review connection
      pooling / index recommendations while you're there.

## 4. Connection pooling

- [ ] Confirm Supavisor (Supabase's built-in pooler) is in use for
      serverless/edge connections — Vercel's serverless functions open and
      close connections far more frequently than a long-running server
      would, and without pooling this can exhaust the database's direct
      connection limit under real traffic. Check **Project Settings →
      Database → Connection Pooling** and confirm the app's connection
      string (if any direct Postgres connection is used anywhere — the
      current app only uses the Supabase JS client over HTTPS, not a raw
      Postgres connection string, so this is likely moot, but verify no
      script or future feature bypasses that).

## 5. Database region

- [ ] Record the project's region here once confirmed (Project Settings →
      Infrastructure) — needed to match the Vercel Function Region setting
      in `docs/VERCEL_PRODUCTION_SETUP.md`.

---

## 6. Tested restoration checklist

This is the part that actually matters — a backup nobody has ever restored
from is not a backup you can rely on. Before go-live, or as soon after as
operationally possible, run through this against a **non-production**
Supabase project (never test a restore against the live production
project):

1. Create a throwaway Supabase project (or use an existing staging project)
   for this test.
2. Trigger a backup/restore point on it (or use an existing PITR window if
   the tier supports it).
3. Make an intentional, identifiable change to some test data (e.g. update
   a single row with a distinctive marker value).
4. Perform an actual restore to a point *before* that change, following
   whatever mechanism your plan tier provides (dashboard-initiated restore,
   or a support-assisted restore, depending on tier).
5. Confirm:
   - [ ] The restored database no longer contains the test marker change.
   - [ ] RLS policies survived the restore intact (spot-check a few tables).
   - [ ] `roles`/`role_permissions`/`has_permission()` still function
         correctly post-restore (run a quick manual login/permission check
         against the restored copy if it's reachable).
   - [ ] Storage bucket contents (if backed up) are also present/correct
         post-restore, not just the database rows referencing them.
6. Record: date tested, who tested it, which environment, what worked, what
   didn't, and how long the restore took end-to-end (this last number
   matters for any future incident — knowing "a restore takes ~40 minutes"
   changes how you communicate downtime during a real incident).
7. Repeat this test periodically (e.g. every time the plan tier changes, or
   at a fixed interval such as every 6 months) — a restore procedure that
   worked once isn't guaranteed to still work after Supabase changes their
   tooling or after the schema grows significantly.

**Until step 4–6 above have actually been executed and recorded, treat
backup/recovery for this project as unverified**, regardless of what the
dashboard claims is "enabled."

---

## 7. Related monitoring (see also PRODUCTION_SECURITY_CHECKLIST.md)

- [ ] Backup failure alerts configured (if the plan tier surfaces backup
      job status/failures — check dashboard notification settings).
- [ ] Database usage alerts (approaching plan storage/connection limits).
- [ ] Storage usage alerts.
- [ ] Certificate expiry alerts (Cloudflare/Vercel typically auto-renew,
      but alerting on unexpected expiry is still worthwhile defense in
      depth).
