import 'server-only';
import { randomUUID } from 'node:crypto';
import { getSelcomConfig } from './config';
import { buildSignedRequestHeaders } from './signer';
import { SelcomApiError, SelcomNetworkError, SelcomTimeoutError } from './errors';
import { maskCredential } from '@/lib/security/mask';
import type { OrderedFields, SelcomApiResult, SelcomEnvelope } from './types';

// No official, actively-maintained Selcom Node SDK was found on the npm
// registry for the Tanzania Business API this integration targets (the
// `@selcom/*` packages that do exist are for a different, Namibia-based
// Selcom product with an unrelated checkout API). The one Tanzania-named
// package found (`selcom-apigw-client`) has a single release from 2023, no
// visible repository, and no way to review its source or maintenance
// status — it does not meet the bar to trust with request signing for a
// disbursement API. This client implements the documented algorithm
// directly against node:crypto and the global fetch API instead.

const DEFAULT_TIMEOUT_MS = 15_000;
const RETRY_DELAYS_MS = [300, 900];

// ── Redaction ────────────────────────────────────────────────────────────
// Field names that must never appear in full in a log line. Matched
// case-insensitively against both header names and request/response field
// names, so this covers 'api-key', 'digest', 'accountNumber',
// 'recipientAccount', 'senderAccount', 'account_number', 'account', etc.
// without needing an exhaustive per-endpoint list.
const SENSITIVE_KEY_PATTERN = /key|secret|digest|token|password|account|msisdn/i;

// Pure and exported specifically so it can be unit-tested directly (see
// client.test.ts) without needing to intercept console output.
export function redactForLog(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactForLog);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key) && val !== null && val !== undefined && typeof val !== 'object') {
        result[key] = maskCredential(String(val));
      } else if (val && typeof val === 'object') {
        result[key] = redactForLog(val);
      } else {
        result[key] = val;
      }
    }
    return result;
  }
  return value;
}

function logSelcomEvent(level: 'info' | 'error', message: string, meta: Record<string, unknown>): void {
  const safeMeta = redactForLog(meta);
  // eslint-disable-next-line no-console
  console[level](`[selcom] ${message}`, safeMeta);
}

// ── Query string / body construction ────────────────────────────────────
function buildQueryString(fields: OrderedFields): string {
  return fields.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&');
}

function buildJsonBody(fields: OrderedFields): string {
  const body: Record<string, string | number> = {};
  for (const [key, value] of fields) {
    body[key] = value;
  }
  return JSON.stringify(body);
}

// ── Core request ─────────────────────────────────────────────────────────
export interface SelcomRequestOptions {
  method: 'GET' | 'POST';
  path: string;
  fields: OrderedFields;
  // Only ever true for read-only lookups (balance, account lookup,
  // transaction status) — see balance.ts/account-lookup.ts/
  // transaction-status.ts. transaction-process.ts never sets this: payout
  // creation is never automatically retried (requirement: a retried
  // network call must never risk appearing as a second disbursement
  // attempt without an explicit, human-triggered retry — see
  // src/lib/payouts/disbursement-adapter.ts's idempotency contract for the
  // same rule applied elsewhere in this codebase).
  retry?: boolean;
  timeoutMs?: number;
  correlationId?: string;
}

async function fetchOnce<TData>(options: SelcomRequestOptions, correlationId: string): Promise<SelcomApiResult<TData>> {
  const config = getSelcomConfig();
  const headers = buildSignedRequestHeaders({
    apiKey: config.apiKey,
    privateKeyPem: config.privateKeyPem,
    fields: options.fields,
    correlationId,
  });

  const isGet = options.method === 'GET';
  const url = isGet
    ? `${config.baseUrl}${options.path}?${buildQueryString(options.fields)}`
    : `${config.baseUrl}${options.path}`;

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  logSelcomEvent('info', `-> ${options.method} ${options.path}`, {
    correlationId,
    headers,
    fields: Object.fromEntries(options.fields),
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method,
      headers,
      body: isGet ? undefined : buildJsonBody(options.fields),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new SelcomTimeoutError(`Selcom request to ${options.path} timed out after ${timeoutMs}ms`, timeoutMs, correlationId);
    }
    throw new SelcomNetworkError(`Selcom request to ${options.path} failed`, err, correlationId);
  } finally {
    clearTimeout(timeout);
  }

  let envelope: SelcomEnvelope<TData> | null = null;
  try {
    envelope = (await response.json()) as SelcomEnvelope<TData>;
  } catch {
    // Non-JSON body — fall through, handled by the !response.ok / !envelope check below.
  }

  logSelcomEvent(response.ok && envelope?.success ? 'info' : 'error', `<- ${response.status} ${options.path}`, {
    correlationId,
    status: response.status,
    result: envelope?.result,
    resultcode: envelope?.resultcode,
    error_code: envelope?.error_code,
  });

  if (!response.ok || !envelope || !envelope.success) {
    throw new SelcomApiError(
      envelope?.message ?? `Selcom request to ${options.path} failed with HTTP ${response.status}`,
      response.status,
      envelope?.error_code ?? null,
      envelope?.resultcode ?? null,
      envelope?.result ?? null,
      correlationId
    );
  }

  return {
    data: envelope.data,
    result: envelope.result,
    resultCode: envelope.resultcode,
    correlationId,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retries only network/timeout failures and the one documented 5xx
// (503 — "Authentication service temporarily unavailable"). Never retries
// a 4xx business/validation error, since resending the same request
// produces the same rejection.
async function withRetry<TData>(options: SelcomRequestOptions, correlationId: string): Promise<SelcomApiResult<TData>> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fetchOnce<TData>(options, correlationId);
    } catch (err) {
      lastError = err;
      const retryable =
        err instanceof SelcomTimeoutError || err instanceof SelcomNetworkError || (err instanceof SelcomApiError && err.isRetryable);
      if (!retryable || attempt === RETRY_DELAYS_MS.length) {
        throw err;
      }
      logSelcomEvent('error', `retrying ${options.path} after attempt ${attempt + 1}`, { correlationId });
      await delay(RETRY_DELAYS_MS[attempt]);
    }
  }
  // Unreachable — the loop above always either returns or throws — but
  // keeps TypeScript satisfied that every path returns or throws.
  throw lastError;
}

export async function selcomRequest<TData>(options: SelcomRequestOptions): Promise<SelcomApiResult<TData>> {
  const correlationId = options.correlationId ?? randomUUID();
  return options.retry ? withRetry<TData>(options, correlationId) : fetchOnce<TData>(options, correlationId);
}
