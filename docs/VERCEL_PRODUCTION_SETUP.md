# Vercel Production Setup — BizLink Africa

## Architecture decision: one Vercel project, host-aware middleware

This repo is a **single Next.js 16 App Router application** — the public
marketing site (`src/app/(site)/...`) and the admin portal
(`src/app/admin/...`) already live in one codebase, sharing the same
Supabase clients, RBAC model, and component library. There is no existing
convention of splitting them into separate deployable units.

Given that, this setup uses **Option C: one Vercel project, with
`src/proxy.ts` enforcing the security boundary by hostname** — not two
separate Vercel projects. Rationale:

- Reuses the existing single-app architecture instead of forcing a
  restructure into two codebases/packages just to get two Vercel projects.
- All three hostnames (`bizlinkafrica.net`, `www.bizlinkafrica.net`,
  `admin.bizlinkafrica.net`) already have a genuine security boundary via
  `src/proxy.ts`: the admin host rewrites into `/admin/*`, the public hosts
  get a non-disclosing 404 on any `/admin/*` request, and an unrecognized
  production hostname is rejected outright. The boundary is enforced at the
  routing layer request-by-request, not by relying on "the other app just
  doesn't have that code" (defense in depth is still `verifyAdminSession()`
  re-checking against Supabase Auth on every protected page, same as
  before).
- One build, one deploy, one set of environment variables to keep in sync.

If a future need arises to give the admin portal fully independent scaling,
build pipelines, or incident blast-radius isolation from the public site,
revisit **Option A** (two Vercel projects, most likely via two root
directories in a restructured monorepo) — that's a genuine architecture
change, not a config toggle, and should get its own review when the need is
concrete rather than being done speculatively now.

---

## Project configuration

**Root directory:** `bizlink-website/` (the repo root already *is* this
directory — if the Vercel project is created from a monorepo-style parent
folder, set Root Directory to `bizlink-website`; if the Git remote's root
already is this folder, leave it as `.`).

**Build command:** `next build` (Vercel's framework preset detects this
automatically from `package.json`'s `build` script — no override needed).

**Output:** default Next.js App Router output (no `output: 'export'` or
custom output directory is configured in `next.config.ts` — do not add one;
this app relies on server-side rendering, Server Actions, and Route
Handlers, all of which require the standard Vercel Node/Edge runtime
output, not a static export).

**Production branch:** `master` (confirmed as the repo's current default
branch and the one `origin` tracks).

**Domain assignment** (all on the same project):

- `bizlinkafrica.net` — Production
- `www.bizlinkafrica.net` — Production (the `www` → apex redirect is
  handled in `next.config.ts`'s `redirects()`, not by Vercel's own
  redirect-to-primary-domain setting — leave Vercel's "redirect to
  <primary domain>" toggle **off** for `www` so it doesn't fight with the
  app-level redirect)
- `admin.bizlinkafrica.net` — Production

**Preview deployment protection:** enable **Vercel Authentication** (or
password protection, depending on plan) for preview deployments. Preview
URLs (`*.vercel.app`) are treated as non-production by `src/proxy.ts`'s host
checks (gated on `VERCEL_ENV === 'production'`), so a preview deployment
does **not** get the host-separation enforcement a real production request
does — protecting preview URLs from public discovery at the Vercel level is
what keeps that acceptable.

**Deployment retention / logs:** use your plan's defaults unless a specific
compliance requirement dictates a longer retention window; if one exists
(see `docs/PRODUCTION_SECURITY_CHECKLIST.md` → Privacy and Compliance),
configure retention to match it explicitly rather than assuming the default
is sufficient.

**Function region:** set to the region closest to the Supabase project's
own region (check **Supabase Dashboard → Project Settings → Infrastructure**
for the exact region — this repo has no record of which region the live
project uses, so don't guess; match Vercel's Function Region to whatever
that turns out to be, to minimize latency between the serverless functions
and the database on every request).

---

## Environment variables

`.env.example` in the repo root is the source of truth for variable
**names** (never commit real values there). Classification:

### Public browser variables (safe in the client bundle)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Public marketing site's own URL (used in transactional email templates that are genuinely public-site-facing, if any) |
| `NEXT_PUBLIC_ADMIN_URL` | Admin portal's URL — used to build staff-invite and internal-notification email links so they resolve on `admin.bizlinkafrica.net` rather than the public host (which now 404s every `/admin/*` path) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key — safe because every table it can reach is behind Row Level Security |

### Server-only variables (never prefix with `NEXT_PUBLIC_`)

| Variable | Purpose |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS entirely — used only in `src/lib/supabase/service.ts` (guarded by `import 'server-only'`), consumed by `src/app/api/inquiries/route.ts`, `src/app/admin/login/actions.ts`, `src/app/admin/(protected)/staff/actions.ts` |
| `RESEND_API_KEY` | Transactional email provider |
| `RESEND_FROM_EMAIL` | Sender address for outgoing email |
| `BIZLINK_NOTIFICATION_EMAIL` | Sole recipient of inquiry notification emails |
| `PROVISIONING_ENCRYPTION_KEY` | Symmetric key for encrypting client-provisioning credentials at rest — irrecoverable if lost; treat with the same care as a private signing key |

Set each of the above under **Vercel Project → Settings → Environment
Variables**, scoped to **Production** (and separately to Preview/Development
if those environments need their own — e.g. a separate non-production
Supabase project or a Resend sandbox key, so preview deployments never send
real transactional email or touch production data).

`src/lib/env.ts` (`assertRequiredEnvVars()`, called from the root layout on
every request) fails loudly with a clear error listing exactly which
variable(s) are missing — but **only** when `VERCEL_ENV === 'production'`,
so an incomplete Preview/Development environment won't be blocked by this
check while a feature is still being built out.

Remove any environment variable from the Vercel dashboard that isn't in the
list above — an unused variable lingering in the dashboard is one more
thing that can leak in a support ticket screenshot or a misconfigured log
line for no benefit.

---

## Serverless/Edge notes

- `src/proxy.ts` is Next.js Edge Middleware (Next 16 renamed the file/
  convention to "proxy," not the runtime model) — it runs on Vercel's Edge
  Network, not in the Node.js function region, so the "Function region"
  setting above applies to the actual page/Server Action/Route Handler
  execution, not to the host-separation logic itself.
- No `vercel.json` exists in the repo and none is required for this setup —
  domain/redirect/header configuration all live in `next.config.ts` and
  `src/proxy.ts`, which is the existing convention this reuses rather than
  introducing a second, competing configuration surface.
