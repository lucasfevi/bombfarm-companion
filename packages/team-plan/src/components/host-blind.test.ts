import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Every component here is prop-driven: it reads a store, a host context, or a host-only global
 * only through what its caller hands it in `data`/`actions`/`slots`. A store read here is the one
 * way a screen "prop-driven and host-blind" claim silently stops being true — the component would
 * still render on the web (which happens to have that store) and break the instant a second host
 * without it tried to draw the same screen.
 */
const PACKAGE_COMPONENTS = fileURLToPath(new URL('.', import.meta.url));

/** This guard's own file, which necessarily spells the specifiers it forbids. */
const SELF_EXCLUDED_FILE = 'host-blind.test.ts';

const HOST_READ_PATTERNS = [/usePlannerStore\(/, /from ['"]@\/shared\/stores['"]/, /useAppLang\(\)/];

function offendingPattern(text: string): RegExp | null {
  return HOST_READ_PATTERNS.find((pattern) => pattern.test(text)) ?? null;
}

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) acc.push(full);
  }
  return acc;
}

describe('packages/team-plan/src/components reads no store or host context', () => {
  it('red state: usePlannerStore(selectHeroes) is caught', () => {
    expect(offendingPattern("const heroes = usePlannerStore(selectHeroes);")).not.toBeNull();
  });

  it('red state: an import from the web store barrel is caught', () => {
    expect(offendingPattern("import { usePlannerStore } from '@/shared/stores';")).not.toBeNull();
  });

  it('red state: useAppLang() is caught', () => {
    expect(offendingPattern('const lang = useAppLang();')).not.toBeNull();
  });

  it('the scan reaches this directory\'s components — it is not passing over an empty set', () => {
    const files = sourceFiles(PACKAGE_COMPONENTS);
    expect(files.length).toBeGreaterThanOrEqual(25);
  });

  it('no component under packages/team-plan/src/components reads a store or host context', () => {
    const offenders: string[] = [];
    for (const abs of sourceFiles(PACKAGE_COMPONENTS)) {
      const rel = path.relative(PACKAGE_COMPONENTS, abs).split(path.sep).join('/');
      if (rel === SELF_EXCLUDED_FILE) continue;
      const hit = offendingPattern(fs.readFileSync(abs, 'utf8'));
      if (hit) {
        offenders.push(`packages/team-plan/src/components/${rel}: matched ${hit}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
