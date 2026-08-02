// Deliberately NOT server-only: PRODUCTION_READINESS_ITEMS and the shared
// types below are used by the client-side checklist/approval components
// (ProductionReadinessChecklist.tsx, ProductionActivationPanel.tsx) as
// real runtime values, not just types — putting them in the same file as
// production-readiness.ts's DB-fetching functions (which import
// 'server-only') would break the client bundle. Nothing in this file ever
// touches process.env, a database client, or any secret.

export interface ProductionReadinessItemDefinition {
  key: string;
  label: string;
  description: string;
}

// The 20-item production activation checklist. Keys are the single source
// of truth (must match the seeded rows in
// 20260823000000_selcom_production_readiness.sql exactly) — labels/
// descriptions are display-only and safe to edit freely.
export const PRODUCTION_READINESS_ITEMS: readonly ProductionReadinessItemDefinition[] = [
  { key: 'sandbox_credentials_configured', label: 'Sandbox credentials configured', description: 'SELCOM_API_KEY, SELCOM_RSA_PRIVATE_KEY, and SELCOM_DISBURSEMENT_ACCOUNT are all set and the private key parses.' },
  { key: 'rsa_signing_tests_passed', label: 'RSA signing tests passed', description: 'signer.ts unit tests pass, and at least one real signed sandbox request has succeeded end to end.' },
  { key: 'balance_api_passed', label: 'Balance API passed', description: 'POST /v1/balance has been exercised successfully against the sandbox account.' },
  { key: 'account_lookup_passed', label: 'Account lookup passed', description: 'GET /v1/account/lookup has been exercised successfully for both a bank and a mobile wallet destination.' },
  { key: 'bank_sandbox_payout_passed', label: 'Bank sandbox payout passed', description: 'At least one sandbox disbursement to a bank account has reached Successful.' },
  { key: 'mobile_wallet_sandbox_payout_passed', label: 'Mobile-wallet sandbox payout passed', description: 'At least one sandbox disbursement to a mobile wallet has reached Successful.' },
  { key: 'status_checking_passed', label: 'Status checking passed', description: 'The status-check-service polling path has successfully resolved at least one payout.' },
  { key: 'callback_received_validated', label: 'Callback received and validated', description: 'A real (or faithfully simulated) Selcom callback has been received and processed by /api/integrations/selcom/callback/[secret].' },
  { key: 'duplicate_transaction_test_passed', label: 'Duplicate transaction test passed', description: 'A repeated/replayed callback or status check for the same transaction was correctly detected as a duplicate, not reprocessed.' },
  { key: 'idempotency_test_passed', label: 'Idempotency test passed', description: 'Resubmitting the same payout reference did not create a second live transaction.' },
  { key: 'maker_checker_test_passed', label: 'Maker-checker test passed', description: 'An approval attempt by the same person who requested/prepared the item was correctly rejected.' },
  { key: 'beneficiary_verification_passed', label: 'Beneficiary verification passed', description: 'The settlement beneficiary verification workflow (account lookup + maker-checker approval) has been exercised end to end.' },
  { key: 'reconciliation_passed', label: 'Reconciliation passed', description: 'Sandbox payout records have been reconciled against Selcom sandbox statements/reports without unresolved variance.' },
  { key: 'financial_audit_logs_passed', label: 'Financial audit logs passed', description: 'audit_logs coverage for payouts/settlement/callback/status-check activity has been reviewed and found complete.' },
  { key: 'rls_security_review_passed', label: 'RLS security review passed', description: 'Row Level Security policies on every Selcom-related table have been reviewed by someone other than the implementer.' },
  { key: 'environment_secrets_reviewed', label: 'Environment secrets reviewed', description: 'All SELCOM_* env vars (sandbox and production) have been reviewed for correct scoping, storage location, and access.' },
  { key: 'production_credentials_generated', label: 'Production credentials generated', description: 'A distinct production API key, RSA key pair, and disbursement account have been generated — never reused from sandbox.' },
  { key: 'production_callback_registered', label: 'Production callback registered', description: 'The production callback URL (with its own secret path) has been registered with Selcom for the production merchant account.' },
  { key: 'production_ip_whitelist_confirmed', label: 'Production IP whitelist confirmed if required', description: 'If Selcom requires source IP whitelisting for production, it has been configured and confirmed. Mark Not Applicable if Selcom does not require it.' },
  { key: 'infinity_disbursement_production_account_confirmed', label: 'Infinity Disbursement production account confirmed', description: 'The production Infinity Disbursement account number has been confirmed correct with Selcom and Finance.' },
] as const;

export type ProductionReadinessItemKey = (typeof PRODUCTION_READINESS_ITEMS)[number]['key'];
export const PRODUCTION_READINESS_ITEM_KEYS: readonly string[] = PRODUCTION_READINESS_ITEMS.map((i) => i.key);

export type ChecklistItemStatus = 'not_started' | 'passed' | 'failed' | 'not_applicable';

export interface ProductionReadinessCheckRow {
  item_key: string;
  status: ChecklistItemStatus;
  notes: string | null;
  checked_by: string | null;
  checked_at: string | null;
}

export interface ProductionApprovalState {
  production_finance_approved: boolean;
  production_finance_approved_by: string | null;
  production_finance_approved_at: string | null;
  production_finance_approval_reason: string | null;
  production_compliance_approved: boolean;
  production_compliance_approved_by: string | null;
  production_compliance_approved_at: string | null;
  production_compliance_approval_reason: string | null;
  production_activation_authorized: boolean;
  production_activation_authorized_by: string | null;
  production_activation_authorized_at: string | null;
  production_activation_authorization_reason: string | null;
  production_deauthorized_by: string | null;
  production_deauthorized_at: string | null;
  production_deauthorization_reason: string | null;
}

// Cheap, honest evidence hints for a subset of checklist items where this
// app already has hard operational evidence on record — shown alongside
// the manual attestation, never substituting for it (a human still has to
// deliberately mark the item passed; this is context, not an auto-pass).
export interface ProductionReadinessEvidence {
  balance_api_passed: number;
  bank_sandbox_payout_passed: number;
  mobile_wallet_sandbox_payout_passed: number;
  status_checking_passed: number;
  callback_received_validated: number;
  duplicate_transaction_test_passed: number;
}

export function isChecklistComplete(checks: ProductionReadinessCheckRow[]): boolean {
  if (checks.length < PRODUCTION_READINESS_ITEM_KEYS.length) return false;
  return checks.every((c) => c.status === 'passed' || c.status === 'not_applicable');
}
