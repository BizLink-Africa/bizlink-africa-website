// Defensive masking for anything API Monitoring might render that could
// contain a secret. api_request_logs has no column designed to hold one
// (no raw headers/body), but endpoints and error text are free-form and
// staff-entered, so a pasted URL with an API key in the query string, a
// bearer token, or a long opaque credential must never reach the screen
// intact. This is belt-and-suspenders on top of "don't store secrets" —
// never the only line of defense.

const SECRET_PATTERNS: RegExp[] = [
  // key=value / token=value / secret=value style query params
  /((?:api[_-]?key|token|secret|password|auth)\s*=\s*)([^&\s"']+)/gi,
  // Authorization: Bearer <token> style
  /(bearer\s+)([a-z0-9._-]{8,})/gi,
  // long opaque alphanumeric strings (likely keys/tokens) of 20+ chars —
  // includes _/- since real key formats use them (whsec_..., sk_live_...)
  /\b([a-z0-9_-]{20,})\b/gi,
];

function maskValue(value: string): string {
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}${'*'.repeat(Math.max(4, value.length - 4))}${value.slice(-2)}`;
}

// Masks any secret-shaped substrings in free text — safe to call on
// endpoints, error messages, or any other staff-entered field before it's
// rendered on an API Monitoring page.
export function maskSecrets(text: string | null | undefined): string {
  if (!text) return '';
  let result = text;
  result = result.replace(SECRET_PATTERNS[0], (_match, prefix: string, value: string) => `${prefix}${maskValue(value)}`);
  result = result.replace(SECRET_PATTERNS[1], (_match, prefix: string, value: string) => `${prefix}${maskValue(value)}`);
  result = result.replace(SECRET_PATTERNS[2], (match) => maskValue(match));
  return result;
}

// For a value known to be a full secret/credential (not free text to scan) —
// always shows only the last 4 characters, regardless of pattern matching.
export function maskCredential(value: string | null | undefined): string {
  if (!value) return '—';
  if (value.length <= 4) return '****';
  return `****${value.slice(-4)}`;
}
