import { describe, expect, it } from 'vitest';
import { csvEscape, csvRow, csvResponseHeaders } from './csv';

describe('csvEscape', () => {
  it('passes through a plain value unchanged', () => {
    expect(csvEscape('hello')).toBe('hello');
    expect(csvEscape(1234.5)).toBe('1234.5');
  });

  it('renders null/undefined as an empty string, never the literal "null"', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  it('quotes and escapes a value containing a comma, quote, or newline', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('a"b')).toBe('"a""b"');
    expect(csvEscape('a\nb')).toBe('"a\nb"');
  });
});

describe('csvRow', () => {
  it('joins cells with commas and terminates with CRLF', () => {
    expect(csvRow(['a', 'b', 1])).toBe('a,b,1\r\n');
  });

  it('escapes cells that need it within a full row', () => {
    expect(csvRow(['Merchant, Inc.', 'ok'])).toBe('"Merchant, Inc.",ok\r\n');
  });
});

describe('csvResponseHeaders', () => {
  it('sets a CSV content type and attachment disposition with the given filename', () => {
    const headers = csvResponseHeaders('report.csv') as Record<string, string>;
    expect(headers['Content-Type']).toContain('text/csv');
    expect(headers['Content-Disposition']).toContain('attachment');
    expect(headers['Content-Disposition']).toContain('report.csv');
  });
});
