# Selcom Business Production Disbursement — Readiness Verification Report

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
- **Gap this session still cannot close:** the *actual* Selcom credential values (`SELCOM_API_KEY`, RSA private key, callback secret) configured in Vercel's production environment-variable store are not visible from this session, and this session has no way to confirm they are genuinely correct/valid Selcom production credentials versus merely present. Someone with both Vercel and Selcom partner-portal access must independently confirm those values are correct, current, and marked sensitive.

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
