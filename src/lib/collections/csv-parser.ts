import { isValidMoneyString } from './money';
import { maskCredential } from '@/lib/security/mask';
import type { ProviderTransactionRow } from './provider-adapter';

export interface CsvParseError {
  row: number;
  message: string;
}

export interface CsvParseResult {
  rows: ProviderTransactionRow[];
  errors: CsvParseError[];
}

const REQUIRED_HEADERS = ['provider_transaction_reference', 'gross_amount', 'collected_at'] as const;
const VALID_TRANSACTION_STATUSES = new Set(['successful', 'failed', 'pending']);
const VALID_REVERSAL_STATUSES = new Set(['none', 'reversed', 'pending_reversal']);
const VALID_CHARGEBACK_STATUSES = new Set(['none', 'disputed', 'chargeback_confirmed']);

// Manual import mode — this is the actual, wired-up import path (not the
// provider-adapter interface, which is unused until live integration is a
// separate, explicit decision). Money columns are validated for shape only
// and passed through as the original string — never parsed to a JS number
// for storage. A raw `payer_reference` column (if present) is masked here
// and the raw value is discarded immediately; only the masked form is ever
// returned.
export function parseCollectionStatementCsv(csvText: string): CsvParseResult {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { rows: [], errors: [{ row: 0, message: 'File is empty.' }] };
  }

  const headers = lines[0].split(',').map((h) => h.trim());
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return { rows: [], errors: [{ row: 0, message: `Missing required column(s): ${missing.join(', ')}` }] };
  }

  const rows: ProviderTransactionRow[] = [];
  const errors: CsvParseError[] = [];
  const seenInFile = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1;
    const cells = lines[i].split(',').map((c) => c.trim());
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = cells[idx] ?? '';
    });

    if (!record.provider_transaction_reference) {
      errors.push({ row: rowNum, message: 'Missing provider_transaction_reference.' });
      continue;
    }
    if (seenInFile.has(record.provider_transaction_reference)) {
      errors.push({ row: rowNum, message: `Duplicate reference within this file: ${record.provider_transaction_reference}.` });
      continue;
    }
    if (!isValidMoneyString(record.gross_amount)) {
      errors.push({ row: rowNum, message: `Invalid gross_amount "${record.gross_amount}".` });
      continue;
    }
    if (record.provider_fee && !isValidMoneyString(record.provider_fee)) {
      errors.push({ row: rowNum, message: `Invalid provider_fee "${record.provider_fee}".` });
      continue;
    }
    const collectedAtDate = record.collected_at ? new Date(record.collected_at) : null;
    if (!collectedAtDate || Number.isNaN(collectedAtDate.getTime())) {
      errors.push({ row: rowNum, message: `Invalid collected_at "${record.collected_at}".` });
      continue;
    }

    const transactionStatus = VALID_TRANSACTION_STATUSES.has(record.transaction_status)
      ? (record.transaction_status as ProviderTransactionRow['transactionStatus'])
      : 'successful';
    const reversalStatus = VALID_REVERSAL_STATUSES.has(record.reversal_status)
      ? (record.reversal_status as ProviderTransactionRow['reversalStatus'])
      : 'none';
    const chargebackStatus = VALID_CHARGEBACK_STATUSES.has(record.chargeback_status)
      ? (record.chargeback_status as ProviderTransactionRow['chargebackStatus'])
      : 'none';

    seenInFile.add(record.provider_transaction_reference);
    rows.push({
      providerTransactionReference: record.provider_transaction_reference,
      tillReference: record.till_reference || null,
      payerReferenceMasked: record.payer_reference
        ? maskCredential(record.payer_reference)
        : record.payer_reference_masked || null,
      grossAmount: record.gross_amount,
      currency: record.currency || 'TZS',
      providerFee: record.provider_fee || '0',
      collectedAt: collectedAtDate.toISOString(),
      transactionStatus,
      reversalStatus,
      chargebackStatus,
    });
  }

  return { rows, errors };
}
