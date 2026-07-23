import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CSS_PATH = join(__dirname, 'globals.css');
const css = readFileSync(CSS_PATH, 'utf8');

// jsdom has no layout/paint engine, so it can't tell us what font actually
// renders — these assertions instead prove the *source of truth* is wired
// correctly: the right token exists, it's applied at the .admin-app scope
// (not body/html, which would also repaint the public marketing site), and
// form controls are pulled in explicitly since browsers don't inherit
// font-family into them by default.
describe('admin typography — Palatino scope', () => {
  it('defines the Palatino font stack as a design token', () => {
    expect(css).toMatch(
      /--font-palatino:\s*'Palatino Linotype',\s*Palatino,\s*'Book Antiqua',\s*Georgia,\s*serif;/
    );
  });

  it('applies the Palatino token to .admin-app, not to body/html', () => {
    const adminAppRule = css.match(/\.admin-app\s*{[^}]*}/)?.[0] ?? '';
    expect(adminAppRule).toMatch(/font-family:\s*var\(--font-palatino\);/);

    const bodyRule = css.match(/\bbody\s*{[^}]*}/)?.[0] ?? '';
    expect(bodyRule).not.toMatch(/--font-palatino/);
    expect(bodyRule).toMatch(/font-family:\s*var\(--font-sans\);/);
  });

  it('makes form controls inside .admin-app inherit the font explicitly', () => {
    // Browsers don't inherit font-family into form controls by default, so
    // each of these needs to appear as its own selector ahead of the shared
    // "font: inherit;" declaration.
    for (const selector of ['.admin-app button', '.admin-app input', '.admin-app select', '.admin-app textarea']) {
      expect(css).toContain(selector);
    }
    const formControlBlock = css.slice(css.indexOf('.admin-app button'));
    expect(formControlBlock).toMatch(/font:\s*inherit;/);
  });
});

describe('admin typography — sidebar Times New Roman exception', () => {
  it('defines the Times New Roman font stack as a design token', () => {
    expect(css).toMatch(/--font-times:\s*'Times New Roman',\s*Times,\s*serif;/);
  });

  it('scopes Times New Roman to .admin-sidebar only, without !important', () => {
    const sidebarRule = css.match(/\.admin-sidebar\s*{[^}]*}/)?.[0] ?? '';
    expect(sidebarRule).toMatch(/font-family:\s*var\(--font-times\);/);
    expect(sidebarRule).not.toMatch(/!important/);
  });

  it('leaves .admin-app on Palatino — dashboard content is unaffected by the sidebar exception', () => {
    const adminAppRule = css.match(/\.admin-app\s*{[^}]*}/)?.[0] ?? '';
    expect(adminAppRule).toMatch(/font-family:\s*var\(--font-palatino\);/);
    expect(adminAppRule).not.toMatch(/--font-times/);
  });

  it('makes sidebar buttons/links/text explicitly inherit the sidebar font', () => {
    for (const selector of ['.admin-sidebar button', '.admin-sidebar a', '.admin-sidebar span', '.admin-sidebar p', '.admin-sidebar select']) {
      expect(css).toContain(selector);
    }
    const inheritBlock = css.slice(css.indexOf('.admin-sidebar button'), css.indexOf('.admin-sidebar button') + 300);
    expect(inheritBlock).toMatch(/font-family:\s*inherit;/);
  });

  it('does not use the universal child selector (.admin-sidebar *) that could touch icon rendering', () => {
    expect(css).not.toContain('.admin-sidebar *');
  });
});

// Regression guard: every element inside the admin app used to hardcode
// font-[Geist,sans-serif], which silently defeats any font applied at an
// ancestor (an explicit font-family on an element always wins over
// inheritance). This walks the admin source tree so a future page.tsx can't
// reintroduce that pattern and quietly break the global Palatino rollout.
function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) files.push(full);
  }
  return files;
}

describe('admin typography — no per-component overrides', () => {
  it('contains no explicit font-family utility on any admin app/component file', () => {
    const roots = [join(__dirname, 'admin'), join(__dirname, '..', 'components', 'admin')];
    const offenders: string[] = [];

    for (const root of roots) {
      for (const file of walk(root)) {
        const contents = readFileSync(file, 'utf8');
        if (/font-\[/.test(contents)) offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});
