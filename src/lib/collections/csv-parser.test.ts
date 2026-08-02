import { describe, expect, it } from 'vitest';
import { parseCollectionStatementCsv } from './csv-parser';

const HEADER = 'provider_transaction_reference,till_reference,gross_amount,provider_fee,currency,collected_at,transaction_status';

describe('parseCollectionStatementCsv — required columns', () => {
  it('rejects a file missing a required column', () => {
    const result = parseCollectionStatementCsv('till_reference,gross_amount\nTILL-1,100.00');
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0].message).toContain('Missing required column');
  });

  it('rejects an empty file', () => {
    const result = parseCollectionStatementCsv('');
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0].message).toContain('empty');
  });
});

describe('parseCollectionStatementCsv — duplicate reference detection within a single file', () => {
  it('flags the second occurrence of the same reference in one file as an error, not a silent row', () => {
    const csv = [
      HEADER,
      'TXN-100,TILL-1,500.00,5.00,TZS,2026-08-01T09:00:00Z,successful',
      'TXN-100,TILL-1,500.00,5.00,TZS,2026-08-01T10:00:00Z,successful',
    ].join('\n');

    const result = parseCollectionStatementCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Duplicate reference within this file');
  });

  it('accepts two different references without flagging either as duplicate', () => {
    const csv = [
      HEADER,
      'TXN-200,TILL-1,500.00,5.00,TZS,2026-08-01T09:00:00Z,successful',
      'TXN-201,TILL-1,500.00,5.00,TZS,2026-08-01T09:05:00Z,successful',
    ].join('\n');

    const result = parseCollectionStatementCsv(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });
});

describe('parseCollectionStatementCsv — money and date validation, never parsed to float for storage', () => {
  it('rejects an invalid gross_amount and preserves the row number', () => {
    const csv = [HEADER, 'TXN-300,TILL-1,not-a-number,5.00,TZS,2026-08-01T09:00:00Z,successful'].join('\n');
    const result = parseCollectionStatementCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]).toMatchObject({ row: 2 });
    expect(result.errors[0].message).toContain('gross_amount');
  });

  it('rejects an invalid collected_at', () => {
    const csv = [HEADER, 'TXN-301,TILL-1,500.00,5.00,TZS,not-a-date,successful'].join('\n');
    const result = parseCollectionStatementCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0].message).toContain('collected_at');
  });

  it('passes the original decimal string through unchanged — never re-parsed to a JS number', () => {
    const csv = [HEADER, 'TXN-302,TILL-1,999999999999.99,0.01,TZS,2026-08-01T09:00:00Z,successful'].join('\n');
    const result = parseCollectionStatementCsv(csv);
    expect(result.rows[0].grossAmount).toBe('999999999999.99');
    expect(result.rows[0].providerFee).toBe('0.01');
    expect(typeof result.rows[0].grossAmount).toBe('string');
  });

  it('defaults an omitted transaction_status to successful and an omitted provider_fee to 0', () => {
    const csv = ['provider_transaction_reference,gross_amount,collected_at', 'TXN-303,500.00,2026-08-01T09:00:00Z'].join('\n');
    const result = parseCollectionStatementCsv(csv);
    expect(result.rows[0].transactionStatus).toBe('successful');
    expect(result.rows[0].providerFee).toBe('0');
  });
});

describe('parseCollectionStatementCsv — payer reference is masked, never retained raw', () => {
  it('masks a raw payer_reference column and discards the raw value', () => {
    const csv = [
      'provider_transaction_reference,gross_amount,collected_at,payer_reference',
      'TXN-400,500.00,2026-08-01T09:00:00Z,255712345678',
    ].join('\n');
    const result = parseCollectionStatementCsv(csv);
    expect(result.rows[0].payerReferenceMasked).not.toContain('255712345678'.slice(0, -4));
    expect(result.rows[0].payerReferenceMasked).toMatch(/5678$/);
  });
});
