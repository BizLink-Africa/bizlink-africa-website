import 'server-only';

// Typed errors for the Selcom integration. Every thrown error here carries a
// stable `code` (safe to branch on) and a `correlationId` (safe to show in
// support tickets / internal logs) — never the signing string, private key,
// digest, or any raw account/wallet number. See client.ts's redaction
// helpers for the same rule applied to request/response logging.

export type SelcomErrorCode =
  | 'CONFIG_INVALID'
  | 'SIGNING_FAILED'
  | 'VALIDATION_FAILED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'API_ERROR';

export abstract class SelcomError extends Error {
  abstract readonly code: SelcomErrorCode;
  readonly correlationId?: string;

  // Not `protected` — the class itself is `abstract`, which already
  // prevents `new SelcomError()` directly; a protected constructor here
  // would additionally (and wrongly) block `new SelcomConfigError(...)`
  // etc. from outside this module, since none of the concrete subclasses
  // below redeclare their own constructor.
  constructor(message: string, correlationId?: string) {
    super(message);
    this.name = new.target.name;
    this.correlationId = correlationId;
  }
}

// Missing or malformed environment variable(s) — thrown by config.ts before
// any request is attempted. Message lists variable NAMES only, never values.
export class SelcomConfigError extends SelcomError {
  readonly code = 'CONFIG_INVALID' as const;
}

// crypto.sign() failed, or the configured private key could not be parsed.
// Message must never include the signing string or key material.
export class SelcomSigningError extends SelcomError {
  readonly code = 'SIGNING_FAILED' as const;
}

// Caller passed a value that fails validation before a request is even
// built (e.g. a malformed amount string) — never a Selcom-side rejection.
export class SelcomValidationError extends SelcomError {
  readonly code = 'VALIDATION_FAILED' as const;
}

// The request was aborted after exceeding the configured timeout.
export class SelcomTimeoutError extends SelcomError {
  readonly code = 'TIMEOUT' as const;

  constructor(message: string, readonly timeoutMs: number, correlationId?: string) {
    super(message, correlationId);
  }
}

// fetch() itself rejected (DNS, TLS, connection reset, etc.) — distinct from
// a Selcom-issued error response, which is SelcomApiError below.
export class SelcomNetworkError extends SelcomError {
  readonly code = 'NETWORK_ERROR' as const;

  constructor(message: string, readonly cause_: unknown, correlationId?: string) {
    super(message, correlationId);
  }
}

// A Selcom endpoint responded with a non-success envelope or non-2xx HTTP
// status. Fields mirror exactly what the docs document as the error
// envelope shape (success/error_code/message/result/resultcode) — nothing
// invented beyond that.
export class SelcomApiError extends SelcomError {
  readonly code = 'API_ERROR' as const;

  constructor(
    message: string,
    readonly httpStatus: number,
    readonly errorCode: number | null,
    readonly resultCode: string | null,
    readonly result: string | null,
    correlationId?: string
  ) {
    super(message, correlationId);
  }

  // 503 is the only 5xx the docs document ("Authentication service
  // temporarily unavailable") — the only API-level condition worth a
  // caller retrying. Everything else (4xx business/validation errors) is
  // not retry-safe: retrying sends the same invalid request again.
  get isRetryable(): boolean {
    return this.httpStatus === 503;
  }
}

export function isSelcomError(value: unknown): value is SelcomError {
  return value instanceof SelcomError;
}
