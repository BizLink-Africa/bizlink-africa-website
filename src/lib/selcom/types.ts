import 'server-only';

// Shapes documented at https://developer.selcom.business/ (Balance API,
// Account Lookup, Transaction Process, Transaction Query) as of this
// integration's implementation. Nothing here is invented: every field name
// below was confirmed against the live documentation. If Selcom's docs add
// or rename fields later, this file — not the call sites — is what needs
// updating. Re-verify against the live docs before relying on this for a
// production cutover.

export type SelcomEnv = 'sandbox' | 'production';

export interface SelcomConfig {
  readonly env: SelcomEnv;
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly privateKeyPem: string;
  readonly disbursementAccount: string;
  readonly callbackSecret: string;
  readonly callbackUrl: string;
}

// An ordered field list is the single source of truth for both the outgoing
// request (body or query string) and the signing string / `signed-fields`
// header derived from it — see signer.ts. Using an array of tuples (not a
// plain object) is deliberate: it makes "signed field order exactly matches
// request payload order" true by construction rather than by convention.
export type OrderedFields = ReadonlyArray<readonly [string, string | number]>;

// The envelope every documented endpoint responds with.
export interface SelcomEnvelope<TData> {
  success: boolean;
  error_code: number;
  message: string;
  result: string;
  resultcode: string;
  data: TData;
}

export interface SelcomApiResult<TData> {
  data: TData;
  result: string;
  resultCode: string;
  correlationId: string;
}

// ── Balance API — POST /v1/balance ──────────────────────────────────────
export interface BalanceRequest {
  accountNumber: string;
}

export interface BalanceData {
  accountNumber: string;
  currency: string;
  availableBalance: number;
  active: boolean;
}

// Raw wire-format Balance response — confirmed via a live sandbox call
// that Selcom returns these fields in snake_case for this endpoint
// specifically (unlike Account Lookup / Transaction Query, which are
// camelCase per the docs and were transcribed correctly). BalanceData
// above is the camelCase shape the rest of this app consumes;
// getAccountBalance() in balance.ts maps one to the other so this
// endpoint-specific casing quirk is handled in exactly one place.
export interface BalanceWireData {
  account_number: string;
  currency: string;
  available_balance: number;
  active: boolean;
}

// ── Account Lookup — GET /v1/account/lookup ─────────────────────────────
export interface AccountLookupRequest {
  bank: string;
  account: string;
  transId: string;
  // Decimal string, matching this codebase's money convention
  // (src/lib/collections/money.ts) — converted to a JSON number only at
  // the wire boundary, never used for arithmetic here.
  amount?: string;
}

export interface AccountLookupCharge {
  [key: string]: unknown;
}

export interface AccountLookupData {
  bank: string;
  account: string;
  accountName: string;
  operator: string;
  charges: AccountLookupCharge[];
  totalCharges: number;
  categoryCode: string;
}

// ── Transaction Process (disbursement) — POST /v1/transaction/process ──
export interface TransactionProcessRequest {
  transId: string;
  recipientFiCode: string;
  recipientAccount: string;
  recipientName: string;
  // Decimal string — see AccountLookupRequest.amount above.
  amount: string;
  purpose: string;
  remarks?: string;
}

export interface TransactionProcessData {
  trans_id: string;
  selcom_receipt: string;
  status: string;
  amount: number;
  currency: string;
}

// ── Transaction Query — GET /v1/transaction/query ───────────────────────
export interface TransactionStatusRequest {
  transId: string;
}

export interface TransactionStatusData {
  transId: string;
  status: string;
  amount: number;
  currency: string;
  selcomReceipt: string;
  transDatetime: string;
  senderAccount: string;
  senderName: string;
}

// ── Inbound Callback — POST to our configured callback URL ─────────────
// Confirmed against Selcom's official callback documentation before this
// was written: `reference_id` and `status` are always present; every other
// field is included only if selected during callback configuration on
// Selcom's side, so all of them are optional here. Callbacks are
// documented as being sent for successful transactions only — failed or
// unresolved payouts must keep using the existing status-check-service.ts
// polling path, never this shape. No signature/HMAC field is documented
// for this payload; see the callback route's header comment for the
// verification mechanisms used instead of a signature.
export interface SelcomCallbackPayload {
  reference_id: string;
  status: string;
  sender_account_name?: string;
  sender_account_number?: string;
  recipient_name?: string;
  recipient_account_number?: string;
  amount?: number | string;
  charges?: unknown;
  selcom_receipt?: string;
}
