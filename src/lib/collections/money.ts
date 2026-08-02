// Money is handled as decimal strings end-to-end — from CSV parsing
// through the Postgres numeric(14,2) columns — and never as JS
// floating-point arithmetic for any value that is stored, summed, or
// otherwise treated as authoritative. Every real calculation (net amount,
// reconciliation totals, variance) happens in Postgres via generated
// columns and SQL SUM — see the 20260809000000 migration.
//
// The two helpers below are the ONLY places this module touches Number():
// validating that a string looks like a valid amount (never converted back
// to a stored value) and formatting an already-final, DB-computed value
// for display. Neither is a calculation.

const DECIMAL_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;

// Validates shape only (up to 2 decimal places, non-negative-looking) —
// never parses to float for storage. The value that gets inserted is
// always the original trimmed string, passed straight to a numeric(14,2)
// column, which Postgres parses exactly.
export function isValidMoneyString(value: string): boolean {
  return DECIMAL_PATTERN.test(value.trim());
}

// Display-only formatting of a value Postgres already computed — never
// used to derive a new monetary total. Returns '—' for anything not a
// finite, already-final number.
export function formatMoney(value: string | number | null | undefined, currency = 'TZS'): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(num)) return '—';
  return `${currency} ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
