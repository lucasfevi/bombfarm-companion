/**
 * The sixth instance of this repo's green-without-executing family:
 * `apps/desktop/playwright.config.ts` enumerates its spec files in a `testMatch`
 * array, so a new `*.spec.mjs` dropped into `tests/smoke/` without a matching entry is silently
 * never run — `pnpm test` and even `pnpm --filter @bombfarm/desktop test:smoke` stay green while
 * the new smoke never executes. A smoke that never ran is not evidence.
 *
 * This guard derives the expected list from the directory itself and asserts `testMatch` is
 * exactly that set — same members, either direction. Deliberately dumb text slicing over
 * `playwright.config.ts` (the `tools/design-system-gate.test.mjs` / `ci-desktop-paths.test.mjs`
 * convention), not a TypeScript parse.
 *
 * The second block below covers the same family from the other end: a committed `.only`
 * narrows a suite to one test and still reports green, so every Playwright config in the repo
 * must set `forbidOnly` on CI.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PLAYWRIGHT_CONFIG_PATH = join(root, 'apps/desktop/playwright.config.ts');
const SMOKE_DIR = join(root, 'apps/desktop/tests/smoke');
const FORBID_ONLY = /forbidOnly:\s*!!process\.env\.CI\s*,/;

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

function readPlaywrightConfigPaths() {
  let output;
  try {
    output = execFileSync('git', ['-c', 'core.quotePath=false', 'ls-files'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    });
  } catch (error) {
    throw new Error(
      `could not list tracked files to discover Playwright configs: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return output
    .split('\n')
    .map((line) => line.replace(/\r$/, '').trim())
    .filter((line) => basename(line) === 'playwright.config.ts')
    .sort();
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

describe('every Playwright config sets forbidOnly on CI', () => {
  it('discovers at least the web and desktop configs from the tracked file list', () => {
    const configs = readPlaywrightConfigPaths();

    expect(
      configs.length,
      `discovery of tracked playwright.config.ts files found {${configs.join(', ')}} — fewer than the ` +
        `two apps that have one. A guard that globs and finds nothing passes while guarding nothing.`,
    ).toBeGreaterThanOrEqual(2);
  });

  it('a committed .only would otherwise reduce a suite to one test and still report green', () => {
    const configs = readPlaywrightConfigPaths();
    const withForbidOnly = configs.filter((path) => FORBID_ONLY.test(readFileSync(join(root, path), 'utf8')));
    const missing = configs.filter((path) => !withForbidOnly.includes(path));

    expect(
      missing,
      `these Playwright configs do not set \`forbidOnly: !!process.env.CI\`: ${missing.join(', ')}. ` +
        `A committed \`.only\` in one of their specs silently narrows the suite to that one test and ` +
        `still reports green. Configs checked: {${configs.join(', ')}}.`,
    ).toEqual([]);
  });

  it('red state demonstrated: a config text without the option is reported as an offender', () => {
    const withoutOption = 'export default defineConfig({\n  workers: 1,\n  retries: 0,\n});\n';

    expect(FORBID_ONLY.test(withoutOption)).toBe(false);
    expect(FORBID_ONLY.test(withoutOption.replace('  workers: 1,\n', '  forbidOnly: !!process.env.CI,\n'))).toBe(true);
  });
});
