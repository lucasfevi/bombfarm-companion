import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';
import { PERSISTED_KEY_BASELINE } from './support/persisted-keys-baseline';

/**
 * No persisted `localStorage` key string changes with this feature —
 * additive fields only, on the existing `-v1` keys. Red state: rename any `bf-hp-*` literal
 * under `src/shared/lib` and this test fails with the exact string that drifted.
 */
function collectPersistedKeyLiterals(dir: string, acc: Set<string> = new Set()): Set<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectPersistedKeyLiterals(full, acc);
      continue;
    }
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
    const text = fs.readFileSync(full, 'utf8');
    for (const match of text.matchAll(/['"](bf-hp-[a-z0-9-]+)['"]/g)) {
      acc.add(match[1]);
    }
  }
  return acc;
}

describe('persisted localStorage key strings', () => {
  it('the bf-hp-* key set under shared/lib matches the recorded develop baseline, byte-identical', () => {
    const found = [...collectPersistedKeyLiterals(path.join(WEB_PACKAGE_ROOT, 'src/shared/lib'))].sort();
    const baseline = [...PERSISTED_KEY_BASELINE].sort();
    expect(found).toEqual(baseline);
  });

  it('the phases feature directory, phases-slice and the phases i18n namespace still exist under those names', () => {
    expect(fs.existsSync(path.join(WEB_PACKAGE_ROOT, 'src/features/phases'))).toBe(true);
    expect(
      fs.existsSync(path.join(WEB_PACKAGE_ROOT, 'src/shared/stores/slices/phases-slice.ts')),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(WEB_PACKAGE_ROOT, 'src/shared/i18n/namespaces/phases.ts')),
    ).toBe(true);
  });
});
