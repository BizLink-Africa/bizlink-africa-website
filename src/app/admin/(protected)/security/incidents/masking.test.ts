// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// "Do not expose plaintext secrets" (Security Incidents spec) — verifies
// every place free-text incident/event fields are rendered or exported
// routes them through maskSecrets() first, rather than relying on someone
// remembering to do it by hand next time a field is added.
describe('Security Incidents / Security Events — secret masking is wired in', () => {
  it('the incident detail page masks containment/resolution/timeline notes', () => {
    const source = readFileSync(join(__dirname, '[id]/page.tsx'), 'utf8');
    expect(source).toContain("from '@/lib/security/mask'");
    expect(source).toContain('maskSecrets(row.containment)');
    expect(source).toContain('maskSecrets(row.resolution)');
    expect(source).toContain('maskSecrets(entry.note)');
  });

  it('the Security Events page masks description', () => {
    const source = readFileSync(join(__dirname, '../../compliance/security-events/page.tsx'), 'utf8');
    expect(source).toContain("from '@/lib/security/mask'");
    expect(source).toContain('maskSecrets(e.description)');
  });

  it('the Security Reports export masks description/containment/resolution', () => {
    const source = readFileSync(join(__dirname, '../reports/export/route.ts'), 'utf8');
    expect(source).toContain("from '@/lib/security/mask'");
    expect(source).toContain('maskSecrets(r.description)');
    expect(source).toContain('maskSecrets(r.containment)');
    expect(source).toContain('maskSecrets(r.resolution)');
  });
});
