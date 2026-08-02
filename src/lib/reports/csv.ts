// Shared CSV formatting for every financial report / statement export
// route in this codebase — extracted from the pattern already used by
// src/app/admin/(protected)/finance/proformas/[id]/export/route.ts.

export function csvEscape(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvEscape).join(',') + '\r\n';
}

export function csvResponseHeaders(filename: string): HeadersInit {
  return {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
  };
}
