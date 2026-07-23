import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// A static regression guard, not a live database check — it re-derives the
// same "every created table gets RLS enabled somewhere in the migration
// history" invariant a manual audit found one real violation of
// (finance_number_sequences, fixed by 20260803000000). This can't see
// anything applied out-of-band (e.g. via the Supabase SQL editor rather
// than a migration file) — Supabase's own Security Advisor is the
// live-database equivalent check (see docs/BACKUP_AND_RECOVERY.md §3).
describe('migrations — every created table has RLS enabled somewhere in history', () => {
  it('has no table created without a matching enable row level security statement', () => {
    const dir = __dirname;
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const created = new Set<string>();
    const rlsEnabled = new Set<string>();

    for (const file of files) {
      const source = readFileSync(join(dir, file), 'utf8');

      for (const match of source.matchAll(/create table if not exists\s+([a-z_][a-z0-9_]*)/gi)) {
        created.add(match[1].toLowerCase());
      }
      for (const match of source.matchAll(/alter table\s+([a-z_][a-z0-9_]*)\s+enable row level security/gi)) {
        rlsEnabled.add(match[1].toLowerCase());
      }
    }

    const missing = [...created].filter((table) => !rlsEnabled.has(table)).sort();
    expect(missing).toEqual([]);
  });

  it('specifically confirms finance_number_sequences has RLS enabled (the gap this session found and fixed)', () => {
    const dir = __dirname;
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql'));
    const enabledAnywhere = files.some((file) =>
      /alter table\s+finance_number_sequences\s+enable row level security/i.test(
        readFileSync(join(dir, file), 'utf8')
      )
    );
    expect(enabledAnywhere).toBe(true);
  });
});
