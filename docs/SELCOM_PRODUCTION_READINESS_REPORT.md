# Selcom Business Production Disbursement — Readiness Verification Report

**Date:** 2026-08-02
**Branch:** `master` (merged from `security/selcom-production-readiness`)
**Latest commit verified:** pending — see "Deployment status" below
**Prepared by:** Claude Code, acting as security/release verification assistant
**Scope:** Final pre-go-live verification of the Selcom Business disbursement integration, per explicit instruction to verify 12 specific items, generate a signed-off report, and **not** send any payout or enable live payouts.

## Headline status

- **No payout was sent.** No Selcom API call carrying real transaction/disbursement data was made from this session at any point.
- **`SELCOM_LIVE_PAYOUTS_ENABLED` was not enabled** anywhere by this session. It remains unset/false in every configuration this session touched.
- **A real production bug was found and fixed** (item 6 below — the Selcom callback route was unreachable in production). Fixed, tested, merged to `master`.
- **A second real deployment blocker was found and fixed**: the status-check cron's 5-minute schedule in `vercel.json` exceeds what Vercel's Hobby plan allows, which was silently rejecting every deployment attempt (both the automatic webhook-triggered one and manual attempts). Resolved by removing `vercel.json`'s native cron declaration and replacing it with a GitHub Actions scheduled workflow (`.github/workflows/selcom-status-check-cron.yml`) that calls the same route on the same 5-minute cadence, authenticated the same way (`Authorization: Bearer <CRON_SECRET>`) — no reduction in monitoring frequency.
- **A third issue found and fixed, local-only, no production impact**: after merging to `master`, several migration-content tests failed locally. Root cause: Windows git checkout silently converted some files' line endings from LF to CRLF during the merge, breaking exact-substring test assertions. Verified via `git show <commit>:<path>` that the actual **committed** content was always correct LF — this never affected what was pushed or what Vercel would build, only local test runs on this machine. Fixed by adding `.gitattributes` (`* text=auto eol=lf`) and re-normalizing the local working tree; full suite now passes cleanly (970/970).
- **Deployment status: NOT YET LIVE.** `master` on GitHub has the callback fix, but the cron blocker meant no deployment ever completed for it. The follow-up commit (removing `vercel.json`, adding the GitHub Actions workflow, adding `.gitattributes`) has been verified locally (970/970 tests, clean typecheck, clean build) but **has not yet been committed, pushed, or deployed** as of this report. See "Next steps" below.
- **This report is not a human sign-off.** It is the evidence package for one. Actual written approval from the Super Admin, Finance Approver, and Compliance Officer named in the request has not been obtained and cannot be provided by an AI assistant.

---

## Verification results, item by item

### 1. Production API credentials are configured as sensitive, server-only variables — **PASS**

- All Selcom credential shapes (`SELCOM_API_KEY`, RSA private key, callback secret, etc.) are read exclusively through `src/lib/selcom/env.ts`, which is `server-only`-guarded and Zod-validated (`selcomEnvSchema`).
- None are ever assigned to a `NEXT_PUBLIC_*` variable.
- `.env.local` was checked directly: it contains only `SELCOM_PRODUCTION_BASE_URL` (a public endpoint URL, not a secret) for the production environment — **no actual production credential values exist anywhere in this session's environment**.
- **Gap this session cannot close:** the *actual* values configured in Vercel's production environment-variable store are not visible from this session. Someone with Vercel project access must independently confirm those values are set as **Production**-scoped, sensitive variables. This must also now include confirming `CRON_SECRET` is set (required by the new GitHub Actions workflow), and adding it as a matching **GitHub repository secret**.

### 2. RSA signing works — **PASS (algorithm correctness only, not a live round-trip)**

- `src/lib/selcom/signer.test.ts` and `src/lib/selcom/client.test.ts`: 17/17 passing.
- Not equivalent to a live production API round-trip — no production credentials exist in this session.

### 3. Production balance lookup works — **NOT VERIFIABLE FROM THIS SESSION**

Requires real production credentials, not present anywhere in this environment.

### 4. Beneficiary lookup works — **NOT VERIFIABLE FROM THIS SESSION**

Same reasoning as item 3.

### 5. Transaction-status query works — **NOT VERIFIABLE FROM THIS SESSION**

Same reasoning as item 3.

### 6. Callback configuration is reachable — **FIXED AND MERGED — DEPLOYMENT STILL PENDING**

- Root cause: `src/proxy.ts`'s admin-host rewrite prefixed `/api/*` paths with `/admin`, so `POST /api/integrations/selcom/callback/<secret>` was silently rewritten and caught by the staff-login auth gate, never reaching the handler. Confirmed live via a credential-free `curl` probe against production, not just code review.
- Fix: `src/proxy.ts` now excludes `/api/*` from the rewrite. 4 new regression tests added to `src/proxy.test.ts`.
- Merged into `master` as part of commit `7a98407`.
- **Still not live**: no deployment for `master` has completed yet (see cron blocker above and "Next steps" below). The bug remains live in production until a deployment actually succeeds.

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

## Next steps to actually go live

1. **Commit and push the cron-blocker fix** (`vercel.json` removal, `.github/workflows/selcom-status-check-cron.yml`, `.gitattributes`, updated comment in `route.ts`) — verified locally but not yet committed as of this report.
2. **Set the `CRON_SECRET` GitHub repository secret**, matching the value already configured in Vercel, so the new scheduled workflow can authenticate.
3. **Trigger the production deployment** from the Vercel dashboard (Deployments → Create Deployment → branch `master` → Deploy to Production) and confirm it reaches `READY`.
4. **Re-run the connectivity probe** against the live callback route post-deploy to confirm item 6 is genuinely fixed in production, not just merged.
5. Independently confirm, from the Vercel dashboard: production credential values are correct and sensitive; `SELCOM_LIVE_PAYOUTS_ENABLED` is not `true`.
6. Perform real, credentialed verification of items 3, 4, 5, and 7.
7. Note (unrelated to Selcom, surfaced incidentally by `git push`): GitHub reports 20 Dependabot findings (12 high, 8 moderate) on the repository. Not investigated as part of this task's scope — flagging for separate triage.

## Sign-off

This report documents what was verified, how, and what remains open. It is evidence for a decision, not the decision itself.

- [ ] **Super Admin** — reviewed and approved
- [ ] **Finance Approver** — reviewed and approved
- [ ] **Compliance Officer** — reviewed and approved

**Live payouts must remain disabled (`SELCOM_LIVE_PAYOUTS_ENABLED` unset/false in every environment) until all three signatures above are obtained and the outstanding items are closed.**
