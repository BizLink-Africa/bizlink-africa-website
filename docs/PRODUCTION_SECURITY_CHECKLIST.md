# Production Security Checklist — BizLink Africa

Manual verification checklist for go-live. Items are grouped by area; each
links to the doc with the detailed procedure where one exists. Check every
box against the real, deployed environment — this document cannot verify
any of these itself (no Cloudflare/Vercel/Supabase dashboard access from
this session).

## Cloudflare DNS / SSL / WAF / Rate limiting / Bot protection

See [CLOUDFLARE_PRODUCTION_SETUP.md](./CLOUDFLARE_PRODUCTION_SETUP.md) for
full procedure.

- [ ] Nameservers delegated from Namecheap to Cloudflare
- [ ] MX / SPF / DKIM / DMARC records preserved — send a test email and
      confirm delivery + check headers for pass on SPF/DKIM/DMARC (a tool
      like mail-tester.com or checking raw headers in Gmail's "Show
      original" both work for this)
- [ ] All three hostnames resolve over HTTPS, proxied through Cloudflare
- [ ] SSL/TLS mode is **Full (strict)**, not Flexible
- [ ] Always Use HTTPS: on
- [ ] Minimum TLS 1.2, TLS 1.3 enabled
- [ ] HSTS enabled only after confirming every hostname is HTTPS-ready
- [ ] WAF managed rules enabled (Log mode first if traffic pattern unknown,
      then Block)
- [ ] Rate limiting rules created for: admin login, password recovery
      (once that flow exists), public contact form, admin mutation APIs,
      exports, uploads
- [ ] Bot protection / Browser Integrity Check enabled
- [ ] Decision recorded on Cloudflare Access for the admin host (used or
      explicitly not used)
- [ ] Admin host has a cache-bypass rule; public host has no
      overly-broad cache-everything rule

## Vercel

See [VERCEL_PRODUCTION_SETUP.md](./VERCEL_PRODUCTION_SETUP.md) for full
procedure.

- [ ] All three domains added and verified on the one Vercel project
- [ ] Every environment variable in `.env.example` is set in Vercel
      (Production scope at minimum); nothing extra/unused lingering
- [ ] Preview deployment protection enabled
- [ ] Function region matches (or is close to) the Supabase project region
- [ ] Production branch is `master`

## Supabase Auth configuration

- [ ] **Site URL** set to `https://admin.bizlinkafrica.net` (never
      localhost, never the public marketing domain)
- [ ] **Redirect URLs** allow-list contains only:
  - `https://admin.bizlinkafrica.net/admin/accept-invite`
  - Any actual password-reset/update-password route once one exists (none
    exists in the app today — see "Known gaps" below)
  - Development URLs (`http://localhost:3000/...`) kept **only** in a
    non-production Supabase project or a dev-scoped config, never merged
    into the production allow-list
- [ ] No broad wildcard redirect URL present
- [ ] SMTP: confirm whether Supabase's default email sending or a custom
      SMTP provider is configured for auth emails (invite, magic link) —
      the app's own transactional emails go through Resend
      (`RESEND_API_KEY`), but Supabase Auth's own built-in emails (e.g. the
      `inviteUserByEmail` invite email itself) are a **separate** delivery
      path configured in Supabase, not Resend. Verify deliverability of
      both independently.
- [ ] Rate limiting on Supabase Auth endpoints reviewed (Supabase applies
      its own GoTrue-level rate limits; confirm current thresholds match
      the Cloudflare rate-limiting rules rather than fighting them)

## Row Level Security

Findings from this session's migration audit (see completion report for
full detail):

- [ ] `finance_number_sequences` — RLS gap fixed by
      `supabase/migrations/20260803000000_secure_finance_number_sequences.sql`;
      **confirm this migration has actually been applied** to the live
      project (writing the file does nothing by itself)
- [ ] Every other table (85 of 86 checked) already has RLS enabled with
      real policies — no other gap found in the migration history, but
      **run Supabase's own Security Advisor** (see
      `docs/BACKUP_AND_RECOVERY.md` §3) against the live database as a
      second, independent check — a static read of migration files can
      miss anything applied out-of-band (e.g. via the SQL editor, not a
      migration file)
- [ ] `proposal-files` storage bucket exists in migrations with correct
      private RLS policies but no application code reference was found —
      confirm whether it's genuinely unused (dead bucket, fine to leave)
      or reached through a path this audit missed
- [ ] `security definer` functions all set `search_path` explicitly —
      confirmed for all 8 found; re-run this check if a new one is added
      later
- [ ] Last-active-Super-Admin protection exists for `UPDATE` on
      `staff_profiles` (demote/deactivate) but **not** for `DELETE` — no
      delete path exists in the app today so this is currently
      unreachable, but if a "delete staff" feature is ever added, add a
      matching `BEFORE DELETE` trigger first

## Storage

- [ ] `contract-files`, `support-attachments`, `proposal-files` all
      private, RLS-scoped by bucket + `has_permission()` — confirmed in
      migrations
- [ ] None of the three buckets has an `UPDATE`/`DELETE` storage policy
      (append-only pattern) — confirm this is intentional, not an
      oversight, for each bucket
- [ ] Signed URL expiry times reviewed for sensitive downloads (verify the
      actual expiry duration used in app code matches your risk tolerance)
- [ ] File upload validation (size limit, extension/MIME allow-list,
      filename sanitization) reviewed per upload path — not exhaustively
      re-verified in this pass; spot-check each of the three bucket's
      upload code paths

## Test-account cleanup

- [ ] `supabase/scripts/cleanup_test_staff.sql` Section 1 (dry run) run
      against the real production database and its output reviewed by a
      human
- [ ] Every candidate account manually confirmed as test/demo, not a real
      staff member — **especially** verify whether `ceo@bizlinkafrica.net`,
      `cfo@bizlinkafrica.net`, `operations@bizlinkafrica.net` are real
      production accounts or leftover test accounts; this script
      deliberately does not auto-flag them (department-style emails alone
      are not a valid test-account signal)
- [ ] A recent backup/PITR checkpoint confirmed before running Section 2
- [ ] Section 2 executed only after both confirmations above
- [ ] Section 3 (post-cleanup verification) run and every check passed:
      zero remaining test accounts, at least one active Super Admin, all 8
      system roles intact
- [ ] Any "MANUAL ACTION REQUIRED" rows the script reported (NOT NULL FK
      columns) individually resolved

## Roles and permissions

- [ ] All 8 system roles confirmed present: Super Admin, CEO, CFO, CTO,
      Operations, Marketing, Customer Support, Compliance & Security
- [ ] Sidebar visibility, page access, API access, object-level access,
      action-button permissions, export permissions, settings permissions,
      and audit access spot-checked for at least one account per role —
      this session verified the *mechanism* (RLS + `has_permission()` +
      `requirePermission()` is consistently applied) but did not exercise
      every permission combination live against the real database

## MFA

- [ ] Confirm current Supabase plan tier supports MFA before committing to
      "require MFA for privileged roles" — this is a plan-dependent
      feature, not something this codebase currently implements at the
      application layer
- [ ] If supported and enabled: Super Admin, CEO, CFO, CTO, and Compliance
      & Security roles specifically required to enrol

## Security headers / CSP

- [ ] `Content-Security-Policy`, `Strict-Transport-Security`,
      `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
      `X-Frame-Options`, `Cross-Origin-Opener-Policy`,
      `Cross-Origin-Resource-Policy` all present — confirmed present in
      `next.config.ts` in this pass; verify they actually reach the
      browser on the deployed site (some proxies/CDNs strip or override
      headers — check via browser dev tools or `curl -I` against the real
      production URL, not just local dev)
- [ ] **Known gap, not fixed in this pass:** `script-src` still includes
      `'unsafe-inline' 'unsafe-eval'`. Removing them requires a
      nonce/hash-based CSP strategy verified against an actual deployed
      Vercel build (Next.js's own bootstrap scripts and dev-mode tooling
      depend on this) — that verification needs a real deployment to test
      against, which wasn't available in this session. Recommended
      approach: deploy with CSP in **Report-Only** mode first
      (`Content-Security-Policy-Report-Only` header, temporarily, with a
      `report-to`/`report-uri` endpoint), observe violation reports for
      real third-party dependencies, then tighten `script-src` and switch
      back to enforcing mode.
- [ ] Admin responses carry `X-Robots-Tag: noindex, nofollow, noarchive,
      nosnippet` — set dynamically in `src/proxy.ts` for the admin host;
      `src/app/admin/layout.tsx` also sets page-level `robots: noindex`
      metadata as a second layer

## CORS / CSRF

- [ ] `src/app/api/inquiries/route.ts` — Origin allow-list added this pass
      (`https://bizlinkafrica.net`, `https://www.bizlinkafrica.net`, plus
      localhost in dev); verify in production that a cross-origin `fetch`
      from an unrelated site is actually rejected (403) and a same-origin
      submission from the real contact page still succeeds
- [ ] Cookie-authenticated Server Actions rely on Next.js's built-in Server
      Action Origin check (Next.js compares the request's Origin against
      the deployment's own host for Server Action POSTs — confirm this is
      still true for the Next.js version in use, 16.2.9, since this is
      framework-provided CSRF protection, not something this app
      implements itself) plus Supabase's `SameSite` cookie scoping

## Input validation / output protection

- [ ] `src/app/api/inquiries/route.ts` already validates every field
      server-side, allow-lists `requestedSolution`/`preferredContactMethod`
      against known catalogs, and caps string lengths — confirmed in this
      pass, no change needed
- [ ] Sort/filter column allow-lists reviewed for any admin list/table page
      accepting a client-supplied sort or filter field — not exhaustively
      re-audited in this pass across every one of the ~150 admin pages;
      spot-check any page with a "sort by" control
- [ ] No stack traces or raw database errors returned to the client — spot
      check a few error paths against the deployed app, not just local dev

## SEO / sitemap / robots

- [ ] `src/app/robots.ts` now returns a full `Disallow: /` for the admin
      host and the public rules otherwise (host-aware, added this pass) —
      confirm both `https://bizlinkafrica.net/robots.txt` and
      `https://admin.bizlinkafrica.net/robots.txt` show the correct,
      different output once deployed
- [ ] `src/app/sitemap.ts` contains only public routes — confirmed, no
      `/admin` entries present
- [ ] No admin links anywhere in public-facing page content (nav, footer,
      body copy) — not re-audited exhaustively this pass; spot-check the
      public site's rendered HTML for any stray `/admin` link
- [ ] Structured data (Organization JSON-LD in `src/app/layout.tsx`)
      structurally valid — verify with Google's Rich Results Test or
      schema.org validator against the live site post-deploy

## Monitoring / observability

- [ ] Uptime monitoring configured for all three hostnames independently
      (a public-site-only uptime check would miss an admin-host-specific
      outage, and vice versa)
- [ ] Application error monitoring configured (none integrated in this
      codebase currently — this is a genuine gap to close, see completion
      report)
- [ ] Failed-login and security-event alerting — `login_events` table
      exists and is written to on every attempt (see
      `src/app/admin/login/actions.ts`); no external alert is wired to it
      yet (e.g. no Slack/email alert on a burst of failures) — currently
      requires manually checking the Security → Logins admin page
- [ ] Deployment alerts, database usage alerts, storage usage alerts,
      certificate alerts — configure via Vercel/Supabase/Cloudflare's
      respective notification settings

## Backups

See [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md) — **do not check
this box until a real restore has been tested and recorded**, not merely
until backups appear "enabled" in the dashboard.

- [ ] Restore procedure tested against a non-production project and result
      recorded

## Email DNS (SPF / DKIM / DMARC)

- [ ] Confirmed present in Cloudflare post-migration (see
      CLOUDFLARE_PRODUCTION_SETUP.md §1)
- [ ] SPF record includes Resend's sending infrastructure (check Resend's
      own domain-verification instructions for the exact `include:` value
      they require — do not guess it)
- [ ] DKIM configured for the sending domain per Resend's setup
      instructions
- [ ] DMARC record present with at least a monitoring (`p=none`) policy to
      start, tightened to `p=quarantine`/`p=reject` once confirmed clean

## Known application-level gaps (not fixed in this pass — tracked here)

- No password-recovery/reset flow exists in the app today (confirmed
  earlier in this project) — the login page correctly does not show a
  "Forgot password" link because of this. Before enabling one, add the
  corresponding Supabase Redirect URL above.
- CSP still permits `'unsafe-inline' 'unsafe-eval'` in `script-src` (see
  above).
- No client-side rate limiting exists on any admin mutation endpoint
  beyond Supabase Auth's own — relies on Cloudflare rate limiting rules
  (see CLOUDFLARE_PRODUCTION_SETUP.md §5) as the actual enforcement layer.
- No application error-monitoring integration (e.g. Sentry) exists yet.
- Turnstile/CAPTCHA is not yet wired into the public contact form's client
  or server code — only server-side field validation and a DB-backed
  per-IP rate limit exist today.
