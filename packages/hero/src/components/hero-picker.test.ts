import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Structural (source-scanning) coverage for the hero and roster views, in the genre this repo
 * already uses for presentational layers it has no component-render idiom for.
 *
 * `readFileSync` on a bare file name is deliberate: a renamed or moved subject throws here rather
 * than leaving a guard that passes while scanning nothing.
 */
const COMPONENTS_DIR = fileURLToPath(new URL('.', import.meta.url));

function read(fileName: string): string {
  return readFileSync(join(COMPONENTS_DIR, fileName), 'utf8');
}

describe('hero picker — the enable/disable switch is a host capability, not a stub', () => {
  it('the write is optional on the actions bag', () => {
    // Spelt with an explicit `| undefined` as well as the `?`: this package is compiled by the
    // desktop under `exactOptionalPropertyTypes`, where a host passing the prop through as
    // `undefined` is rejected unless the declaration admits it.
    expect(read('hero-picker/hero-picker-dialog.tsx')).toContain(
      'onSetBattleAllowed?: ((heroId: string, enabled: boolean) => void) | undefined;',
    );
  });

  it('head and body drop the Status column on the SAME condition — no column-count mismatch', () => {
    const head = read('hero-picker/hero-picker-table.tsx');
    const row = read('hero-picker/hero-picker-row.tsx');
    expect(head).toMatch(/\{onSetBattleAllowed \? \([\s\S]*?t\.rosterColStatus/);
    expect(row).toMatch(/\{onSetBattleAllowed \? \([\s\S]*?HeroActiveToggle/);
  });

  it('no disabled switch stands in for the absent write — the control is not rendered at all', () => {
    const row = read('hero-picker/hero-picker-row.tsx');
    expect(row).not.toMatch(/disabled=\{!onSetBattleAllowed\}/);
    expect(row).not.toMatch(/onSetBattleAllowed\s*\?\?/);
  });
});

/**
 * The property that lets two apps render one screen: every component here takes what it shows,
 * and reaches for nothing. A component reading a host store would compile, pass every test above,
 * and silently make the package un-renderable by any host but that one.
 *
 * The walk is recursive, so a component filed into a subdirectory (the hero picker) is covered
 * rather than quietly exempt.
 */
describe('the components are prop-driven — no store, no host module', () => {
  const HOST_REACH = [
    /\busePlannerStore\b/,
    /\bzustand\b/,
    /\buseShallow\b/,
    /from\s*'@\/[^']*'/,
    /from\s*'@bombfarm\/(web|desktop)/,
  ];

  function findHostReach(text: string): string | null {
    for (const pattern of HOST_REACH) {
      const match = pattern.exec(text);
      if (match) return match[0];
    }
    return null;
  }

  function componentFilesUnder(dir: string, prefix = ''): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? componentFilesUnder(join(dir, entry.name), `${prefix}${entry.name}/`)
        : entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')
          ? [`${prefix}${entry.name}`]
          : [],
    );
  }

  const componentFiles = componentFilesUnder(COMPONENTS_DIR);

  it('red state: a fabricated usePlannerStore subscription is caught', () => {
    expect(findHostReach('const heroes = usePlannerStore(selectRoster);')).toBe('usePlannerStore');
  });

  it('red state: a fabricated import from the web app alias is caught', () => {
    expect(findHostReach("import { sub } from '@/shared/i18n';")).toBe("from '@/shared/i18n'");
  });

  it('the scan reaches every component in this tree, subdirectories included', () => {
    expect(componentFiles.length).toBe(7);
    expect(componentFiles).toContain('phases-hero-switcher.tsx');
    expect(componentFiles).toContain('hero-picker/hero-picker-row.tsx');
    expect(componentFiles).toContain('hero-picker/roster-sort-header.tsx');
  });

  it('green state: no component reads a store or imports a host module', () => {
    const offenders = componentFiles
      .map((name) => ({ name, hit: findHostReach(read(name)) }))
      .filter((entry) => entry.hit);
    expect(offenders, offenders.map((o) => `${o.name}: ${o.hit}`).join('\n')).toEqual([]);
  });
});
