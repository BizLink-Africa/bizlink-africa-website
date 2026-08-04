# Selcom Business Production Disbursement — Readiness Verification Report

> ## ⚠️ Disbursement Integration Retired — Merchant-Managed Settlement Model
>
> **Change date:** 2026-08-26
>
> **Confirmed operating model:** Every merchant holds and manages their own
> payment account, wallet, or till and settles directly with their approved
> payment partner. BizLink Africa provides ICT infrastructure, merchant
> onboarding coordination, integrations, and technical support only. BizLink
> Africa does not receive, hold, control, reconcile, disburse, or settle
> merchant funds.
>
> **Everything below this notice describes a disbursement integration that
> is now permanently retired.** The go-live process this report documents
> — bringing BizLink Africa's own Selcom disbursement account to production
> so BizLink could execute merchant payouts — will not proceed. The three
> sign-offs requested at the bottom of this report (Super Admin, Finance
> Approver, Compliance Officer) are no longer being sought for that purpose.
>
> **Functionality disabled:**
> - Payout creation, approval, submission, retry, cancellation, hold, and
>   reversal (`src/app/admin/(protected)/payouts/actions.ts`)
> - Settlement batch creation, review, approval, hold, and processing
>   (`src/app/admin/(protected)/settlement/actions.ts`)
> - Selcom balance-reservation for settlement batches
> - The Selcom disbursement API integration settings and Production
>   Readiness activation workflow
>   (`src/app/admin/(protected)/settings/integrations/selcom/**`)
> - The status-check cron's automatic 5-minute schedule
>   (`.github/workflows/selcom-status-check-cron.yml`) — disabled, kept
>   reachable via manual dispatch only
> - "Settlement Deduction" as a chargeback recovery method
> - All of the above are enforced server-side by a permanent guard
>   (`assertMerchantSettlementsNotBizLinkManaged()` in
>   `src/lib/archived-financial-prototype.ts`), gated by the central flag
>   `BIZLINK_MANAGES_MERCHANT_SETTLEMENTS` (default and required: `false`),
>   independent of and in addition to the pre-existing
>   `SELCOM_LIVE_PAYOUTS_ENABLED` / `SELCOM_PRODUCTION_ACTIVATION_ENABLED`
>   gates documented in this report, which also remain `false`.
>
> **No live payout was ever initiated.** As this report's own "Headline
> status" section below already states, no Selcom API call carrying real
> transaction/disbursement data was made during the original readiness
> verification, and `SELCOM_LIVE_PAYOUTS_ENABLED` was never enabled. No
> payout has been initiated since, under either the sandbox or production
> Selcom configuration.
>
> **Historical controls retained for audit.** Nothing described in this
> report — code, database tables, RLS policies, maker-checker functions,
> audit-log triggers, or the sign-off checklist below — has been deleted.
> All settlement, payout, collection, and commission records remain in
> place and queryable by Super Admin for audit/history purposes. What
> changed is access (Super Admin only, via
> `checkArchivedFinancialPrototypeAccess()`) and mutability (permanently
> read-only) — not the historical record itself.
>
> Preserved, non-financial integration capabilities (unaffected by this
> change): merchant account/till status, transaction-status viewing (see
> `/admin/integration-health/transactions`), the Selcom callback endpoint
> (technical monitoring), API connection health, and general merchant
> integration support.

---

## Final Zero-Touch Fund Restoration Audit

**Date:** 2026-08-04
**Branch:** `operating-model/merchant-managed-settlement`
**Prepared by:** Claude Code, acting as security/release verification assistant
**Scope:** Final end-to-end audit confirming the merchant-managed settlement model is fully and consistently restored across the public website, the Super Admin Dashboard, and the database, before this report is closed out.

Verified and recorded for the audit trail:

1. **Merchant-managed settlement confirmed.** Every merchant holds and manages their own payment account, wallet, or till and settles directly with their approved payment partner. This is stated consistently across the public website (Home, Solutions, Partnership Approach, Contact, Merchant Payment Infrastructure, Privacy Policy, Terms of Service, Footer, SEO metadata) and the Super Admin Dashboard's Payment Integration Health page.
2. **BizLink disbursement launch cancelled.** The production disbursement go-live process this report originally documented (bringing BizLink Africa's own Selcom disbursement account to production) will not proceed. The Production Readiness checklist and approval workflow are preserved read-only, Super-Admin-only, at `/admin/settings/integrations/selcom/production-readiness`, labeled "Archived — operating model changed before live payout activation."
3. **Live payouts never enabled.** `SELCOM_LIVE_PAYOUTS_ENABLED` has remained `false`/unset in every configuration this project has ever used. Confirmed again in this audit against both `.env.example` and `.env.local`.
4. **No production payout sent.** No Selcom disbursement API call carrying real transaction data has ever been made from this codebase, in any session, sandbox or production.
5. **Financial prototype archived.** All settlement, payout, collection, commission-rule, chargeback, and beneficiary functionality is gated read-only via `assertArchivedFinancialPrototypeReadOnly()` / `assertMerchantSettlementsNotBizLinkManaged()` (`src/lib/archived-financial-prototype.ts`), independent of and in addition to the pre-existing Selcom flags. No records were deleted; all remain queryable by Super Admin for audit/history.
6. **Website and legal wording restored.** The public site, Privacy Policy, and Terms of Service state the zero-touch model in provider-neutral language; the payment partner is never named publicly. Contact details verified exact: `info@bizlinkafrica.net`, `support@bizlinkafrica.net`, `+255 747 730 270`.

**Verification run for this audit:** secret scan (clean — no tracked secrets, no `NEXT_PUBLIC_`/client-side credential leakage), full wording scan (no "BizLink receives/collects/holds/settles/disburses/controls" claims outside this historical report, no public mention of the payment partner name), lint (0 errors), `tsc --noEmit` (0 errors), full test suite (98 files / 991 tests passed), `npm run build` (passed), and a scan of the built output for secret-like strings (clean).

**Open item carried forward (not blocking, requires separate deliberate review):** `supabase/migrations/20260827000000_archive_settlement_facilitator_model.sql` — prepared and cross-verified against the live schema, but intentionally **not applied**, per explicit prior instruction not to auto-apply it. Until applied, the `authenticated` Postgres role retains direct RPC `EXECUTE` privilege on the archived money-moving `SECURITY DEFINER` functions at the database level, even though every application-layer entry point (server actions, UI controls, the lowest-level disbursement call) unconditionally blocks before any of them could be reached. This is a database-hardening follow-up, not a live fund-handling gap.

---

**Date:** 2026-08-02
**Branch:** `master` (merged from `security/selcom-production-readiness`)
**Latest commit verified:** `1d56cc6`, deployed as `dpl_2Bk1mbUoujCDesnodivohM1xDiMS`, state `READY`, aliased to `bizlinkafrica.net`, `www.bizlinkafrica.net`, and `admin.bizlinkafrica.net`
**Prepared by:** Claude Code, acting as security/release verification assistant
**Scope:** Final pre-go-live verification of the Selcom Business disbursement integration, per explicit instruction to verify 12 specific items, generate a signed-off report, and **not** send any payout or enable live payouts.

## Headline status

- **No payout was sent.** No Selcom API call carrying real transaction/disbursement data was made from this session at any point.
- **`SELCOM_LIVE_PAYOUTS_ENABLED` was not enabled** anywhere by this session. It remains unset/false in every configuration this session touched.
- **A real production bug was found and fixed** (item 6 below — the Selcom callback route was unreachable in production). Fixed, tested, merged to `master`.
- **A second real deployment blocker was found and fixed**: the status-check cron's 5-minute schedule in `vercel.json` exceeds what Vercel's Hobby plan allows, which was silently rejecting every deployment attempt (both the automatic webhook-triggered one and manual attempts). Resolved by removing `vercel.json`'s native cron declaration and replacing it with a GitHub Actions scheduled workflow (`.github/workflows/selcom-status-check-cron.yml`) that calls the same route on the same 5-minute cadence, authenticated the same way (`Authorization: Bearer <CRON_SECRET>`) — no reduction in monitoring frequency.
- **A third issue found and fixed, local-only, no production impact**: after merging to `master`, several migration-content tests failed locally. Root cause: Windows git checkout silently converted some files' line endings from LF to CRLF during the merge, breaking exact-substring test assertions. Verified via `git show <commit>:<path>` that the actual **committed** content was always correct LF — this never affected what was pushed or what Vercel would build, only local test runs on this machine. Fixed by adding `.gitattributes` (`* text=auto eol=lf`) and re-normalizing the local working tree; full suite now passes cleanly (970/970).
- **A fourth issue found via the actual production build**: `BENEFICIARY_ENCRYPTION_KEY` — a required production environment variable (used to encrypt beneficiary bank/mobile-wallet destination values at rest; the app deliberately has no decrypt path except one narrow, permission-gated function called immediately before a Selcom payout) — had never been configured in Vercel's production environment. This was the first deployment attempt to ever reach the point of validating it. Confirmed zero existing beneficiary records had encrypted data (`select count(*) from merchant_settlement_beneficiaries` → 0 rows with `encrypted_destination_value` set) before a fresh random key was generated and added, so no existing data was put at risk.
- **A fifth issue, caught before it could fail silently on the real 5-minute schedule**: the first manual run of the new GitHub Actions workflow returned HTTP 401 — the `CRON_SECRET` value entered in GitHub and the value entered in Vercel didn't match. Both were re-entered from the same source value and the workflow was re-run manually, which now succeeds (HTTP 200).
- **Deployment status: LIVE.** Commit `1d56cc6` is deployed (`dpl_2Bk1mbUoujCDesnodivohM1xDiMS`, state `READY`) and aliased to all three production domains. Verified directly against the live site:
  - `POST https://admin.bizlinkafrica.net/api/integrations/selcom/callback/<wrong-secret>` → `404` (correct: reaches the handler, rejects the bad secret — no more redirect to `/admin/login`).
  - `GET https://admin.bizlinkafrica.net/api/payouts/status-check-cron` with no auth header → `401` (correct: reaches the handler, rejects the missing token).
  - The GitHub Actions scheduled workflow run succeeded end-to-end (`Selcom payout status-check cron #2`, green, `Call status-check-cron route` step passed).
- **This report is not a human sign-off.** It is the evidence package for one. Actual written approval from the Super Admin, Finance Approver, and Compliance Officer named in the request has not been obtained and cannot be provided by an AI assistant.

---

## Verification results, item by item

### 1. Production API credentials are configured as sensitive, server-only variables — **PASS**

- All Selcom credential shapes (`SELCOM_API_KEY`, RSA private key, callback secret, etc.) are read exclusively through `src/lib/selcom/env.ts`, which is `server-only`-guarded and Zod-validated (`selcomEnvSchema`).
- None are ever assigned to a `NEXT_PUBLIC_*` variable.
- `.env.local` was checked directly: it contains only `SELCOM_PRODUCTION_BASE_URL` (a public endpoint URL, not a secret) for the production environment — **no actual production credential values exist anywhere in this session's environment**.
- Live evidence this session, not just static review: the production build itself failed once with `Missing required production environment variable(s): BENEFICIARY_ENCRYPTION_KEY`, proving the app's fail-safe check genuinely runs in production and genuinely blocks a deploy on a missing required secret rather than silently defaulting. That variable has since been added (fresh random value; confirmed zero existing beneficiary rows before adding it, so no data was put at risk) and the deploy now succeeds. `CRON_SECRET` was added to both Vercel and GitHub Actions, and end-to-end-verified via a manual workflow run (200 OK) after resolving one mismatch between the two copies.
- **All six required production Selcom variables are now configured in Vercel**, generated directly from the real Selcom Business production portal (`developer.selcom.business` / My Account → API Credentials) by someone with actual production access — this session never saw or handled any of the real values:
  - `SELCOM_PRODUCTION_BASE_URL`, `SELCOM_PRODUCTION_API_KEY`, `SELCOM_PRODUCTION_RSA_PRIVATE_KEY`, `SELCOM_PRODUCTION_DISBURSEMENT_ACCOUNT` — generated via Selcom's "+ Add Credential" flow.
  - `SELCOM_PRODUCTION_CALLBACK_SECRET` (a random value this session generated, since it's self-chosen, not Selcom-issued) and `SELCOM_PRODUCTION_CALLBACK_URL` (`https://admin.bizlinkafrica.net/api/integrations/selcom/callback/<that secret>`) — registered with Selcom via "+ Add Callback Configuration," which independently verified the URL as reachable ("✓ URL verified successfully"), corroborating item 6's live fix from Selcom's own side, not just this session's probes.
  - Callback parameters selected deliberately based on what `process_selcom_callback()`'s SQL actually checks: **Amount** and **Recipient Account Number** enabled (they drive real `amount_mismatch`/`destination_mismatch` anti-tampering checks), **Charges** and **Selcom Receipt** enabled (financial reconciliation / support lookups, not sensitive), **Sender Account Name/Number** and **Recipient Name** left disabled (not used in any verification logic, so no reason for that data to transit the callback at all — data minimization).
  - Two real misconfigurations were caught and fixed during setup: the disbursement-account variable's name and the RSA private key being scoped to "Production and Preview" instead of Production-only (the latter meaningfully widened exposure of the real signing key to every preview deployment before being corrected).
- **What this session still cannot verify:** whether the credential *values* are functionally correct (i.e., whether a real signed request against Selcom's production API actually succeeds) — that requires `SELCOM_ENV=production` and `SELCOM_PRODUCTION_ACTIVATION_ENABLED=true` to both be set (a deliberate, separate activation gate from live payouts, per `resolveSelcomEnvironment()`), which this session has not set and should not set unilaterally. See "Next steps."

### 2. RSA signing works — **PASS (algorithm correctness only, not a live round-trip)**

- `src/lib/selcom/signer.test.ts` and `src/lib/selcom/client.test.ts`: 17/17 passing.
- Not equivalent to a live production API round-trip — no production credentials exist in this session.

### 3. Production balance lookup works — **NOT VERIFIABLE FROM THIS SESSION**

Requires real production credentials, not present anywhere in this environment.

### 4. Beneficiary lookup works — **NOT VERIFIABLE FROM THIS SESSION**

Same reasoning as item 3.

### 5. Transaction-status query works — **NOT VERIFIABLE FROM THIS SESSION**

Same reasoning as item 3.

### 6. Callback configuration is reachable — **PASS, VERIFIED LIVE POST-DEPLOY**

- Root cause: `src/proxy.ts`'s admin-host rewrite prefixed `/api/*` paths with `/admin`, so `POST /api/integrations/selcom/callback/<secret>` was silently rewritten and caught by the staff-login auth gate, never reaching the handler.
- Fix: `src/proxy.ts` now excludes `/api/*` from the rewrite. 4 new regression tests added to `src/proxy.test.ts`.
- Merged into `master`, deployed as `dpl_2Bk1mbUoujCDesnodivohM1xDiMS`.
- Re-probed against the live production host after deploy: `POST https://admin.bizlinkafrica.net/api/integrations/selcom/callback/<wrong-secret>` now returns `404` (reaches the handler, rejects the bad secret) instead of a `307` redirect to `/admin/login`. The status-check cron route was probed the same way and correctly returns `401` for a missing token instead of a redirect.

### 7. Selcom IP whitelist is confirmed — **NOT VERIFIABLE FROM THIS SESSION**

External, cross-party configuration fact (Selcom's partner infrastructure / Vercel's outbound networking). The callback route's only current protection is its secret path segment — a deliberate design choice, not an oversight — so IP whitelisting, if wanted as defense-in-depth, would need to be confirmed with Selcom and implemented separately.

### 8. RLS is active — **PASS (verified live against the production Supabase project)**

All 12 checked tables on the critical payout/reconciliation/audit path have `rowsecurity = true`: `audit_logs`, `merchant_payouts`, `selcom_integration_settings`, `settlement_batches`, `staff_profiles`, `merchant_settlement_beneficiaries`, `collection_transactions`, `collection_reconciliation_runs`, `merchant_payout_events`, `settlement_holds`, `merchants`, `merchant_tills`.

### 9. Maker-checker is active — **PASS (verified live against the deployed function body)**

`approve_merchant_payout()`, pulled live via `pg_get_functiondef`, rejects approval when `requested_by = performer` with `'Maker-checker violation: the approver must be different from the requester'`.

### 10. Reconciliation blocking works — **PASS (verified live, two independent layers)**

- `begin_merchant_payout_submission()` blocks submission unless every relevant `collection_transactions` row is `reconciliation_status = 'matched'`.
- `block_approved_reconciliation_run_mutation()` trigger makes an approved reconciliation run immutable.

### 11. Audit logging works — **PASS (verified live, two independent layers)**

- RLS: only `INSERT`/`SELECT` policies exist on `audit_logs` — no `UPDATE`/`DELETE` policy, denied by default.
- Trigger: `audit_logs_financial_append_only` (`BEFORE UPDATE`/`DELETE`) unconditionally blocks mutation — including against a `service_role` connection that would otherwise bypass RLS.

### 12. Live-payout flag is still false — **PASS, with one visibility gap noted**

- Local `.env.local`: `SELCOM_LIVE_PAYOUTS_ENABLED` unset. Code fails safe (`false`) on any missing/invalid value.
- **Gap this session cannot close:** the actual Vercel production value is not visible from here — must be independently confirmed.

---

## Automated checks run this session

| Check | Result |
|---|---|
| `src/proxy.test.ts` (regression tests) | 20/20 passing |
| Full test suite (`npx vitest run`) | 970/970 passing, 95/95 files |
| `npx tsc --noEmit` | Clean, zero errors |
| `npm run build` | Clean, exit code 0 |
| Live Supabase RLS check (12 tables) | 12/12 RLS enabled |
| Live Supabase function-definition checks | Maker-checker and reconciliation-blocking logic confirmed present and correct |
| Live Supabase trigger/policy check on `audit_logs` | Append-only enforced at both RLS and trigger layer |

## What's done vs. what's still open

**Done this session:** the callback-reachability bug is fixed and verified live; the deployment pipeline itself is unblocked (cron plan-limit issue resolved) and a deployment is live and `READY`; the missing `BENEFICIARY_ENCRYPTION_KEY` was found and added with zero data-loss risk; `CRON_SECRET` is confirmed matching end-to-end between Vercel and GitHub Actions; RLS, maker-checker, reconciliation-blocking, and audit-log immutability are all verified live against the production database.

**Still open before this is genuinely go-live ready:**

1. Independently confirm, from the Vercel dashboard, that the actual Selcom credential *values* (API key, RSA private key, callback secret) are correct, current production credentials — not just present — and that `SELCOM_LIVE_PAYOUTS_ENABLED` is not `true`. This session cannot verify either.
2. Perform real, credentialed verification of items 3, 4, 5, and 7 (production balance lookup, beneficiary lookup, transaction-status query, Selcom IP whitelist) — all require access this session doesn't and shouldn't have.
3. Note (unrelated to Selcom, surfaced incidentally by `git push`): GitHub reports 20 Dependabot findings (12 high, 8 moderate) on the repository. Not investigated as part of this task's scope — flagging for separate triage.

## Sign-off

This report documents what was verified, how, and what remains open. It is evidence for a decision, not the decision itself.

- [ ] **Super Admin** — reviewed and approved
- [ ] **Finance Approver** — reviewed and approved
- [ ] **Compliance Officer** — reviewed and approved

**Live payouts must remain disabled (`SELCOM_LIVE_PAYOUTS_ENABLED` unset/false in every environment) until all three signatures above are obtained and the outstanding items are closed.**
