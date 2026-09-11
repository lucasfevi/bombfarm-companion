import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * This package renders the optimizer for two hosts. Neither may be named from inside it: not
 * the `@/` alias (the web's own path convention), not a relative reach into either app's tree,
 * and not a bare `apps/web` / `apps/desktop` specifier. A host wires this package to itself —
 * this package never wires itself to a host.
 */
const PACKAGE_SRC = fileURLToPath(new URL('.', import.meta.url));
const PACKAGE_ROOT = path.join(PACKAGE_SRC, '..');

/** This guard's own file, which necessarily spells the specifiers it forbids. */
const SELF_EXCLUDED_FILE = 'host-independence.test.ts';

const HOST_SPECIFIER_RE =
  /['"](?:@\/[^'"]*|(?:\.\.\/)+apps\/(?:web|desktop)[^'"]*|apps\/(?:web|desktop)\/[^'"]*)['"]/;

function findHostImport(text: string): string | null {
  return HOST_SPECIFIER_RE.exec(text)?.[0] ?? null;
}

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) acc.push(full);
  }
  return acc;
}

function hostDependencyNames(): string[] {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'),
  ) as Record<string, Record<string, string> | undefined>;
  return ['dependencies', 'peerDependencies'].flatMap((field) =>
    Object.keys(manifest[field] ?? {}).filter(
      (name) => name === '@bombfarm/web' || name === '@bombfarm/desktop',
    ),
  );
}

describe('@bombfarm/team-plan imports from neither host app', () => {
  it('red state: the `@/` alias is caught', () => {
    expect(findHostImport("import { x } from '@/shared/stores';")).not.toBeNull();
  });

  it('red state: a relative reach into apps/web is caught', () => {
    expect(findHostImport("import { x } from '../../../apps/web/src/x';")).not.toBeNull();
  });

  it('red state: a bare apps/desktop specifier is caught', () => {
    expect(findHostImport("import { x } from 'apps/desktop/renderer/x';")).not.toBeNull();
  });

  it('the scan reaches this package\'s sources — it is not passing over an empty set', () => {
    const files = sourceFiles(PACKAGE_SRC);
    const names = files.map((abs) => path.basename(abs));
    expect(names).toContain('team-plan-screen.tsx');
    expect(names).toContain(SELF_EXCLUDED_FILE);
    expect(files.length).toBeGreaterThanOrEqual(40);
  });

  it('the package manifest declares no host-app dependency', () => {
    const declared = hostDependencyNames();
    expect(declared, declared.join('\n')).toEqual([]);
  });

  it('no source file under packages/team-plan/src imports a host app', () => {
    const offenders: string[] = [];
    for (const abs of sourceFiles(PACKAGE_SRC)) {
      const rel = path.relative(PACKAGE_SRC, abs).split(path.sep).join('/');
      if (rel === SELF_EXCLUDED_FILE) continue;
      const hit = findHostImport(fs.readFileSync(abs, 'utf8'));
      if (hit) {
        offenders.push(
          `packages/team-plan/src/${rel}: imports "${hit}" — this package must never depend on a host app`,
        );
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
