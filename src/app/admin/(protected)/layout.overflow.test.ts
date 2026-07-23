import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Regression guard for a real bug: <main> is a flex item inside a
// `flex flex-col` column, and flex items default to min-width: auto — a
// wide child (e.g. a table with min-w-[900px]) can force <main> itself to
// stay wide, pushing the whole page into horizontal overflow instead of
// letting that table's own overflow-x-auto wrapper scroll internally as
// intended. Only <main>'s *parent* wrapper had min-w-0; <main> itself
// didn't, which was enough to let the bug through.
describe('admin protected layout — no whole-page horizontal overflow', () => {
  it('gives <main> its own min-w-0, not just its parent wrapper', () => {
    const source = readFileSync(join(__dirname, 'layout.tsx'), 'utf8');
    const mainTag = source.match(/<main className="[^"]*">/)?.[0] ?? '';
    expect(mainTag).toContain('min-w-0');
  });
});
