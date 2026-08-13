/**
 * The sixth instance of this repo's green-without-executing family (design.md §0 item 5, §11
 * hazard 7): `apps/desktop/playwright.config.ts` enumerates its spec files in a `testMatch`
 * array, so a new `*.spec.mjs` dropped into `tests/smoke/` without a matching entry is silently
 * never run — `pnpm test` and even `pnpm --filter @bombfarm/desktop test:smoke` stay green while
 * the new smoke never executes. A smoke that never ran is not evidence.
 *
 * This guard derives the expected list from the directory itself and asserts `testMatch` is
 * exactly that set — same members, either direction. Deliberately dumb text slicing over
 * `playwright.config.ts` (the `tools/design-system-gate.test.mjs` / `ci-desktop-paths.test.mjs`
 * convention), not a TypeScript parse.
 */
import { readFileSync, readdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PLAYWRIGHT_CONFIG_PATH = join(root, 'apps/desktop/playwright.config.ts');
const SMOKE_DIR = join(root, 'apps/desktop/tests/smoke');

function readTestMatch(configText) {
  const match = configText.match(/testMatch:\s*\[([^\]]*)\]/);
  if (!match) throw new Error('could not find a testMatch: [...] array in playwright.config.ts');
  return match[1]
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => entry.replace(/^['"]|['"]$/g, ''));
}

function readSmokeDirSpecFiles() {
  return readdirSync(SMOKE_DIR).filter((name) => name.endsWith('.spec.mjs'));
}

describe('playwright.config.ts testMatch equals the tests/smoke/*.spec.mjs directory listing', () => {
  it('same members, either direction — a smoke that never ran is not evidence', () => {
    const configText = readFileSync(PLAYWRIGHT_CONFIG_PATH, 'utf8');
    const testMatch = readTestMatch(configText).sort();
    const onDisk = readSmokeDirSpecFiles().sort();

    const registeredButMissing = testMatch.filter((name) => !onDisk.includes(name));
    const onDiskButUnregistered = onDisk.filter((name) => !testMatch.includes(name));

    expect(
      registeredButMissing,
      `testMatch registers a spec file that does not exist on disk: ${registeredButMissing.join(', ')}`,
    ).toEqual([]);
    expect(
      onDiskButUnregistered,
      `tests/smoke/*.spec.mjs has a file testMatch does not register, so it silently never runs: ` +
        `${onDiskButUnregistered.join(', ')}. A smoke that never ran is not evidence — add it to ` +
        `playwright.config.ts's testMatch array.`,
    ).toEqual([]);
  });

  it('red state demonstrated: an unregistered probe spec file is caught, then removed', () => {
    const probePath = join(SMOKE_DIR, 'zz-probe.spec.mjs');
    writeFileSync(probePath, "import { test } from '@playwright/test';\ntest.skip('probe', () => {});\n");
    try {
      const configText = readFileSync(PLAYWRIGHT_CONFIG_PATH, 'utf8');
      const testMatch = readTestMatch(configText);
      const onDisk = readSmokeDirSpecFiles();
      const onDiskButUnregistered = onDisk.filter((name) => !testMatch.includes(name));
      expect(onDiskButUnregistered).toEqual(['zz-probe.spec.mjs']);
    } finally {
      if (existsSync(probePath)) rmSync(probePath);
    }
    expect(existsSync(probePath)).toBe(false);
  });
});
