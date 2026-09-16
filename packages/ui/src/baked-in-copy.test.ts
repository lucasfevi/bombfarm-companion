import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guard: no user-facing English baked into a design-system component.
 *
 * The design system carries no copy of its own — every string a host reads on screen is passed in
 * as a prop, so a localised host stays localised. A literal on a text-bearing JSX attribute
 * (`aria-label`, `title`, `placeholder`, `alt`) is the shape that broke this: `Num`'s
 * `aria-label="Increment"` shipped two English words to screen-reader users on every localised
 * screen, invisible to the apps' own copy guards because it never reached a dictionary. This scans
 * packages/ui itself so the next one fails here, at the source.
 *
 * Scope is deliberately the attribute-literal shape (reliable, no false positives). It does not try
 * to judge bare JSX text — that is a noisier problem, and the desktop's own i18n guard
 * (apps/desktop/src/main/i18n-guards.test.ts) covers what actually reaches that host. A prop
 * DEFAULT (`label = 'x'`, spaces around `=`) is a host-overridable fallback, not a baked-in
 * attribute, and is intentionally not matched.
 */

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

// A text-bearing attribute set to a string literal with no spaces around `=` (JSX form,
// `attr="x"` / `attr='x'`), distinct from a destructured prop default (`attr = 'x'`).
const BAKED_IN_ATTR = /(?<=[\s<])(aria-label|title|placeholder|alt)=(?:"[^"]*"|'[^']*')/;

function tsxSources(dir: string): string[] {
  const out: string[] = [];
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      out.push(...tsxSources(full));
      continue;
    }
    if (!dirent.name.endsWith('.tsx')) continue;
    if (dirent.name.endsWith('.stories.tsx') || dirent.name.endsWith('.test.tsx')) continue;
    out.push(full);
  }
  return out;
}

function bakedInOffenders(source: string): { line: number; text: string }[] {
  return source
    .split('\n')
    .map((line, index) => ({ line: index + 1, match: line.match(BAKED_IN_ATTR) }))
    .filter((entry): entry is { line: number; match: RegExpMatchArray } => entry.match !== null)
    .map((entry) => ({ line: entry.line, text: entry.match[0].trim() }));
}

describe('no user-facing English is baked into a design-system component', () => {
  it('no shipped packages/ui component sets a text attribute to a literal — the host passes it', () => {
    const offenders = tsxSources(SRC_DIR)
      .flatMap((file) =>
        bakedInOffenders(readFileSync(file, 'utf8')).map(
          (hit) => `${relative(SRC_DIR, file)}:${hit.line}  ${hit.text}`,
        ),
      );
    expect(
      offenders,
      'Baked-in user-facing text in packages/ui — give the component a label prop the host passes ' +
        'from its own dictionary (see Num, ToastProvider), not a hardcoded aria-label/title/placeholder/alt.',
    ).toEqual([]);
  });

  it('red state: the exact shape it must catch (Num’s old aria-label) is flagged', () => {
    const fixture = '  <button aria-label="Increment" onClick={inc}>+</button>';
    expect(bakedInOffenders(fixture)).toEqual([{ line: 1, text: 'aria-label="Increment"' }]);
  });

  it('a host-overridable prop default (spaces around =) is not mistaken for a baked-in attribute', () => {
    const fixture = "function C({ title = 'Bomb Farm' }) { return <h1>{title}</h1>; }";
    expect(bakedInOffenders(fixture)).toEqual([]);
  });

  it('an expression-valued attribute (the host string threaded through) is allowed', () => {
    const fixture = '  <button aria-label={incrementLabel}>+</button>';
    expect(bakedInOffenders(fixture)).toEqual([]);
  });
});
