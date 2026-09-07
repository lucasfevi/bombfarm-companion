import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The dependency between these two packages runs one way: `@bombfarm/farm` may render the hero and
 * roster views, and `@bombfarm/hero` may never reach back. A single import the other way — a
 * type-only one included, since it still ties the two build graphs together — makes the pair
 * mutually dependent and the extraction pointless.
 */
const PACKAGE_SRC = fileURLToPath(new URL('.', import.meta.url));
const PACKAGE_ROOT = path.join(PACKAGE_SRC, '..');

/** This guard's own file, which necessarily spells the specifier it forbids. */
const SELF_EXCLUDED_FILE = 'dependency-direction.test.ts';

const FARM_SPECIFIER_RE = /['"](@bombfarm\/farm(?:\/[^'"]*)?)['"]/;

function findFarmImport(text: string): string | null {
  return FARM_SPECIFIER_RE.exec(text)?.[1] ?? null;
}

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) acc.push(full);
  }
  return acc;
}

function farmDependencyNames(): string[] {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'),
  ) as Record<string, Record<string, string> | undefined>;
  return ['dependencies', 'peerDependencies'].flatMap((field) =>
    Object.keys(manifest[field] ?? {})
      .filter((name) => name === '@bombfarm/farm' || name.startsWith('@bombfarm/farm/'))
      .map((name) => `${field}.${name}`),
  );
}

describe('@bombfarm/hero never depends on @bombfarm/farm', () => {
  it('red state: a fabricated import of the farm package is caught', () => {
    expect(findFarmImport("import { x } from '@bombfarm/farm';")).toBe('@bombfarm/farm');
  });

  it('red state: a fabricated type-only import of a farm subpath is caught', () => {
    expect(findFarmImport("import type { FarmCopy } from '@bombfarm/farm/copy';")).toBe(
      '@bombfarm/farm/copy',
    );
  });

  it('green state: an import of a package whose name merely starts the same way is not caught', () => {
    expect(findFarmImport("import { x } from '@bombfarm/farmhouse';")).toBeNull();
  });

  it('the scan reaches this package\'s sources — it is not passing over an empty set', () => {
    const names = sourceFiles(PACKAGE_SRC).map((abs) => path.basename(abs));
    expect(names).toContain('hero-picker-dialog.tsx');
    expect(names).toContain('roster-copy.ts');
    expect(names.length).toBeGreaterThanOrEqual(15);
  });

  it('the package manifest declares no farm dependency', () => {
    const declared = farmDependencyNames();
    expect(declared, declared.join('\n')).toEqual([]);
  });

  it('no source file under packages/hero/src imports the farm package', () => {
    const offenders: string[] = [];
    for (const abs of sourceFiles(PACKAGE_SRC)) {
      const rel = path.relative(PACKAGE_SRC, abs).split(path.sep).join('/');
      if (rel === SELF_EXCLUDED_FILE) continue;
      const hit = findFarmImport(fs.readFileSync(abs, 'utf8'));
      if (hit) {
        offenders.push(
          `packages/hero/src/${rel}: imports "${hit}" — @bombfarm/hero must never depend on @bombfarm/farm`,
        );
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
