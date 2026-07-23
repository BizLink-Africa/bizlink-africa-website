# Cloudflare Production Setup — BizLink Africa

This document is a manual dashboard runbook. It intentionally does **not**
hardcode any DNS record target, nameserver, or IP address — those values are
assigned per-account by Cloudflare and per-project by Vercel at the moment
you do this, and copying a value from a different account/project into this
file would silently break the site. Follow the "copy the exact value shown"
steps below instead.

Domains involved:

- `bizlinkafrica.net` / `www.bizlinkafrica.net` — public marketing site
- `admin.bizlinkafrica.net` — admin portal

Both are served by the **same** Vercel project (see
[VERCEL_PRODUCTION_SETUP.md](./VERCEL_PRODUCTION_SETUP.md) for why this is
one app with host-aware routing, not two separate deployments), so all three
hostnames point at the same Vercel project.

---

## 1. Namecheap → Cloudflare delegation

1. In Cloudflare, click **Add a Site** and enter `bizlinkafrica.net`. Choose
   the Free plan (sufficient for WAF managed rules, rate limiting rules, and
   basic bot protection — verify current plan limits against Section 4/5
   below before assuming a specific feature tier).
2. Cloudflare will scan existing DNS records and then show you **two
   nameservers** (they look like `xxx.ns.cloudflare.com` / `yyy.ns.cloudflare.com`
   — the exact names are assigned per-site by Cloudflare; copy them from your
   dashboard, do not reuse nameserver names from any other Cloudflare site).
3. **Before changing anything else**, open the DNS records Cloudflare
   imported from the scan and manually cross-check them against Namecheap's
   current **Advanced DNS** tab for `bizlinkafrica.net`. Specifically
   confirm every existing:
   - `MX` record (mail routing)
   - `TXT` record, especially the **SPF** record (`v=spf1 ...`)
   - Any **DKIM** `TXT`/`CNAME` records (often named like
     `selector1._domainkey`)
   - Any **DMARC** `TXT` record (`_dmarc.bizlinkafrica.net`)

   Cloudflare's automatic scan usually finds these, but automatic scans can
   miss records or fetch stale data — **verify by hand, record by record,
   against what Namecheap currently shows**, and add anything missing
   directly in Cloudflare *before* you cut over nameservers. If company
   email breaks during this migration, missing/incorrect MX or SPF/DKIM/DMARC
   records are almost always why.
4. Log into **Namecheap → Domain List → Manage** (for `bizlinkafrica.net`).
5. Under **Nameservers**, choose **Custom DNS**.
6. Enter the exact two nameservers Cloudflare showed you in step 2 — not a
   generic Cloudflare nameserver name copied from documentation or another
   site.
7. Save.
8. Propagation/activation can take anywhere from a few minutes to ~24 hours.
   Cloudflare will email you and show the site as **Active** in the
   dashboard once it detects the nameserver change.
9. **From this point on, manage all DNS for `bizlinkafrica.net` exclusively
   in Cloudflare.** Namecheap's own DNS records tab becomes inert once
   nameservers point at Cloudflare — do not edit records there afterward
   expecting them to take effect.

---

## 2. Adding the DNS records themselves (do not guess the target)

For **each** of the three hostnames, the process is the same and must be
done in this order — Vercel first, then Cloudflare, never the reverse:

1. In the **Vercel** project (see VERCEL_PRODUCTION_SETUP.md), go to
   **Settings → Domains** and add the domain (`bizlinkafrica.net`,
   `www.bizlinkafrica.net`, and `admin.bizlinkafrica.net` — add all three to
   the same project).
2. Vercel will display the **exact DNS record** it needs for that hostname
   (this differs by hostname: the apex domain typically needs an `A` record
   to a Vercel IP, while `www` and other subdomains typically need a
   `CNAME` to `cname.vercel-dns.com` — but **use whatever Vercel's own
   dashboard shows you at the time**, not a value written down here or
   remembered from a previous project).
3. Copy that exact record into Cloudflare **DNS → Records → Add record**,
   using the same type, name, and target Vercel displayed.
4. Return to Vercel and let it re-check domain verification. Wait for the
   domain to show a valid/verified state and an issued SSL certificate.
5. Confirm `https://` loads correctly for that hostname.
6. Test that the Cloudflare orange-cloud (proxied) icon doesn't break
   anything — Vercel's own certificate issuance and routing generally work
   fine proxied, but if verification or SSL fails while proxied, temporarily
   switch that record to **DNS only** (grey cloud) until Vercel finishes
   issuing/verifying, then re-enable proxying and re-test.
7. Only enable orange-cloud proxying (rather than DNS-only) once you've
   confirmed HTTPS works correctly for that hostname — proxying is what
   gives you Cloudflare's WAF, rate limiting, and bot protection (Section 4
   and 5 below), so the public and admin hostnames should end up proxied,
   not DNS-only, once verified.

Repeat for all three hostnames before moving on.

---

## 3. SSL/TLS

In Cloudflare, **SSL/TLS → Overview**:

- Set encryption mode to **Full (strict)** — never **Flexible**. Flexible
  SSL means Cloudflare-to-origin traffic is unencrypted HTTP, which is
  unacceptable for a site handling authenticated sessions and Supabase
  cookies. Full (strict) requires a valid certificate at the origin (Vercel
  provides one automatically), which you should already have from Section 2.

**SSL/TLS → Edge Certificates:**

- **Always Use HTTPS**: On.
- **Automatic HTTPS Rewrites**: On (rewrites accidental `http://` links in
  page content to `https://` — check it doesn't break any legitimate
  intentionally-`http` third-party embed; this app has none currently, so
  it's safe to enable).
- **Minimum TLS Version**: 1.2.
- **TLS 1.3**: On.
- **HSTS**: enable **only after** you've confirmed all three hostnames
  (`bizlinkafrica.net`, `www.bizlinkafrica.net`, `admin.bizlinkafrica.net`)
  serve valid HTTPS successfully. The app already sends its own
  `Strict-Transport-Security` header with `includeSubDomains; preload`
  (`next.config.ts`) — Cloudflare's HSTS toggle is an additional edge-level
  enforcement layer, not a replacement. `preload` in particular is
  effectively permanent once submitted to browser preload lists, so do not
  enable it until you are certain every subdomain will always be HTTPS-only.

---

## 4. WAF (Web Application Firewall)

**Security → WAF:**

- Enable **Cloudflare Managed Rules**.
- Enable the **OWASP Core Ruleset** if your plan includes it (paid plans;
  confirm current plan entitlement in the dashboard before assuming it's
  available).
- **Bot Fight Mode** / **Super Bot Fight Mode** (naming varies by plan):
  enable, and monitor for false positives against the admin login flow and
  the public contact form before tightening further.
- **Browser Integrity Check**: enable where available — it blocks requests
  with clearly malformed/missing browser headers with negligible risk of
  blocking real users.

Start with managed rules in **Log** mode if you're unsure how much
legitimate traffic they might affect, review the Security Events log for a
few days, then switch to **Block/Challenge**.

---

## 5. Rate limiting rules

Create these under **Security → WAF → Rate limiting rules**. Thresholds
below are deliberately conservative starting points — **watch real traffic
for at least a few days and adjust**; a threshold copied verbatim without
observing your actual legitimate traffic pattern risks either blocking real
users or doing nothing useful.

| Rule | Match | Suggested starting threshold | Action |
|---|---|---|---|
| Admin login | Host equals `admin.bizlinkafrica.net` AND URI Path equals `/admin/login` | 10 requests / 1 minute per IP | Managed Challenge, then Block after repeated triggers |
| Password recovery | Host equals `admin.bizlinkafrica.net` AND URI Path contains the actual reset-password endpoint (none exists yet in-app — see PRODUCTION_SECURITY_CHECKLIST.md; add this rule once a real reset flow ships) | 5 requests / 15 minutes per IP | Block |
| Public contact form | Host equals `bizlinkafrica.net` OR `www.bizlinkafrica.net` AND URI Path equals `/api/inquiries` AND Method equals `POST` | 10 requests / 15 minutes per IP (the app itself already enforces a stricter 5-per-15-minutes DB-backed limit — see `src/app/api/inquiries/route.ts` — so this Cloudflare rule is a coarser first line of defense, not the only one) | Managed Challenge |
| Admin API mutation endpoints | Host equals `admin.bizlinkafrica.net` AND Method in (POST, PUT, PATCH, DELETE) | 60 requests / 1 minute per IP | Managed Challenge |
| Exports | Host equals `admin.bizlinkafrica.net` AND URI Path contains `/export` | 10 requests / 5 minutes per IP | Managed Challenge |
| File uploads | Host equals `admin.bizlinkafrica.net` AND URI Path contains an upload endpoint (verify actual paths in-app before enabling — none confirmed as a public/heavy endpoint at time of writing) | 10 requests / 5 minutes per IP, plus a Cloudflare "max upload size" setting under **Rules → Configuration Rules** if available on your plan | Block |

Add **Turnstile** (Cloudflare's CAPTCHA alternative) to the public contact
form once you've generated a site key/secret pair in the Cloudflare
dashboard (**Turnstile** section) — this requires adding the Turnstile
widget to the contact form's client code and verifying the token
server-side in `src/app/api/inquiries/route.ts`, which is an app-code change
this document doesn't perform (see PRODUCTION_SECURITY_CHECKLIST.md for this
as an open follow-up).

---

## 6. Cloudflare Access (optional, additional layer for the admin host)

Cloudflare Access can require an authorized email (via a one-time code or
your identity provider) **before** a request even reaches
`admin.bizlinkafrica.net` — a second layer in front of the app's own
Supabase-based login.

If you choose to enable it:

- Restrict it to a small, explicit allow-list of real staff email addresses.
- Do **not** treat Access as a replacement for the app's own RBAC
  (`has_permission()`, `requirePermission()`) — it only gates *reaching* the
  login page, not what a signed-in user can do once inside. Supabase
  authorization must remain the real access-control layer.
- Do not enable this if it would conflict with the staff invite flow (an
  invited staff member must be able to reach `/admin/accept-invite` to set
  their password the first time — make sure any Access policy allows that
  path, or scope Access to exclude it).

This is optional and not required for go-live; document the decision either
way in PRODUCTION_SECURITY_CHECKLIST.md.

---

## 7. Cache rules

**Public website** (`bizlinkafrica.net`, `www.bizlinkafrica.net`):

- Let Cloudflare cache static assets (`/_next/static/*`, images, fonts)
  respecting the cache headers Next.js already sets — no additional
  Cloudflare Cache Rule is required for these by default.
- Do **not** create a blanket "cache everything" page rule — the public
  site has no per-visitor personalization today, but a blanket rule would
  also cache the `/api/inquiries` route's responses if misconfigured, which
  must never happen (each response is specific to that submission).

**Admin portal** (`admin.bizlinkafrica.net`):

- Add a **Cache Rule** that sets Cache Level to **Bypass** for the entire
  `admin.bizlinkafrica.net` hostname (or, if managing one shared rule set
  across hostnames, for every `/admin/*` path — see `src/proxy.ts` for why
  that prefix is the right match even under host-based routing). Every page
  under this host is either an authentication surface or a
  permission-gated, per-user dashboard — nothing on it is safe to cache at
  a shared edge.
- Confirm no existing "cache everything" page rule from the pre-Cloudflare
  setup applies to `/admin/*` — check **Page Rules** in addition to **Cache
  Rules**, since older Cloudflare accounts may have both mechanisms active
  and a legacy Page Rule can silently override a newer Cache Rule.

---

## 8. Verification checklist for this document

- [ ] Namecheap nameservers point at Cloudflare
- [ ] MX / SPF / DKIM / DMARC records confirmed present in Cloudflare and
      company email still works
- [ ] All three hostnames resolve, are proxied (orange cloud), and serve
      valid HTTPS
- [ ] SSL/TLS mode is Full (strict), not Flexible
- [ ] HSTS enabled only after confirming all subdomains are HTTPS-ready
- [ ] WAF managed rules enabled
- [ ] Rate limiting rules created and thresholds noted for later tuning
- [ ] Admin host has a cache-bypass rule; public host does not have an
      overly broad cache-everything rule
- [ ] Decision recorded on whether Cloudflare Access is used for the admin
      host
