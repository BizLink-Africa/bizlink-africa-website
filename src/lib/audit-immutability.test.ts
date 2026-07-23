// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// "Audit history cannot be deleted" — audit_logs has no delete RLS policy
// at the database layer (see 20260713040000_create_phase2_foundation.sql:
// "Deliberately no update/delete policy — audit entries are append-only"),
// and this is the matching app-layer guarantee: nothing in the codebase
// ever calls .delete() against the audit_logs table. Walks the whole src
// tree rather than a fixed file list, so a future module accidentally
// wiring up audit log deletion fails this test immediately rather than
// silently shipping.
function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      walk(fullPath, files);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('audit_logs immutability', () => {
  it('no source file calls .delete() against the audit_logs table', () => {
    const srcDir = join(__dirname, '..');
    const files = walk(srcDir);
    const offenders: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      // Matches "audit_logs" followed by a .delete( call within a short
      // window, tolerant of .eq()/.match() chains and whitespace/newlines
      // in between (e.g. supabase.from('audit_logs').eq(...).delete()).
      if (/audit_logs[\s\S]{0,120}\.delete\(/.test(content)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});
