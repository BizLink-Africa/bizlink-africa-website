// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

// Security-audit finding: this page previously had NO server-side
// permission check at all — it queried onboarding_checklists/staff_profiles
// directly, relying only on (a) proxy.ts's "are you logged in at all" gate
// and (b) RLS's is_active_staff() check, neither of which is specific to
// onboarding.view. Any active staff member of any role could reach it.
// Fixed by adding requirePermission('onboarding.view'), matching the
// sidebar's declared permission and this codebase's universal
// "every page independently enforces its own permission" convention.
describe('Client Onboarding — sidebar permission matches page enforcement', () => {
  const group = NAV_GROUPS.find((g) => g.label === 'Operations');
  if (!group) throw new Error('Operations group not found in navigation.ts');

  const item = group.items.find((i) => i.href === '/admin/onboarding');

  it('Operations includes Client Onboarding gated by onboarding.view', () => {
    expect(item).toBeDefined();
    expect(item?.permission).toBe('onboarding.view');
  });

  it('page.tsx requires onboarding.view server-side', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).toContain(`requirePermission('onboarding.view')`);
    expect(source).toContain('AccessDenied');
  });

  it('page.tsx checks the permission before querying any data', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    const permCheckIdx = source.indexOf(`requirePermission('onboarding.view')`);
    const firstQueryIdx = source.indexOf('.from(');
    expect(permCheckIdx).toBeGreaterThan(-1);
    expect(firstQueryIdx).toBeGreaterThan(permCheckIdx);
  });
});
