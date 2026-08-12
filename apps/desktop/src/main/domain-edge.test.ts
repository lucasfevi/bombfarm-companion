import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FUSE_FLOOR } from '@bombfarm/domain/model';
import { TEAM_PLAN_WORKER_MARKER } from '@bombfarm/domain/team-plan';
import { fuseSecondsForCdr } from './domain-edge.js';

const repoRoot = resolve(__dirname, '../../../..');
const desktopRoot = resolve(__dirname, '../..');
const mainBundlePath = resolve(desktopRoot, 'dist/main/index.cjs');

/** GitHub Actions sets `CI=true`; be liberal about what other runners set. */
function isCi(): boolean {
  const raw = process.env.CI;
  if (raw === undefined || raw === '') return false;
  const normalized = raw.toLowerCase();
  return normalized !== '0' && normalized !== 'false';
}

/**
 * Guard for the bundle assertion below, which needs a real `pnpm --filter @bombfarm/desktop
 * build:electron` output — a plain `vitest run` has none. Same shape as
 * `apps/web/src/tests/support/build-output.ts`: a silent local skip is fine (the build takes
 * real time and this suite also runs against source edits that never touch the bundle), but a
 * missing bundle in CI is a hard failure — it means the workflow's build-before-test ordering
 * regressed, and that must be loud, not a quiet green (this repo's most-repeated defect shape).
 */
function requireDesktopBundle(): boolean {
  if (existsSync(mainBundlePath)) return true;

  if (isCi()) {
    throw new Error(
      `[domain-edge.test] ${mainBundlePath} is missing in CI. This assertion needs ` +
        '`pnpm --filter @bombfarm/desktop build:electron` (or `build`) to have run first.',
    );
  }

  console.info(
    `[domain-edge.test] ${mainBundlePath} absent — skipping the bundle assertion. Run ` +
      '`pnpm --filter @bombfarm/desktop build:electron` to exercise it locally.',
  );
  return false;
}

describe('apps/desktop main process <-> @bombfarm/domain edge (MP3 F1, AD-032)', () => {
  it('@bombfarm/domain is a declared workspace dependency, not a phantom', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(desktopRoot, 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };

    expect(
      manifest.dependencies?.['@bombfarm/domain'],
      'apps/desktop/package.json must declare "@bombfarm/domain": "workspace:*" under ' +
        'dependencies — without it the import resolves only because pnpm hoists every ' +
        'workspace package into the repo-root node_modules/@bombfarm/ (a phantom dependency).',
    ).toBe('workspace:*');
  });

  it('prebuild and predev both build @bombfarm/domain', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(desktopRoot, 'package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> };

    expect(manifest.scripts?.prebuild ?? '').toContain('--filter @bombfarm/domain');
    expect(manifest.scripts?.predev ?? '').toContain('--filter @bombfarm/domain');
  });

  it('exactOptionalPropertyTypes and noUncheckedIndexedAccess are still on for apps/desktop/src', () => {
    const base = JSON.parse(readFileSync(resolve(repoRoot, 'tsconfig.base.json'), 'utf8')) as {
      compilerOptions: Record<string, unknown>;
    };
    const main = JSON.parse(readFileSync(resolve(desktopRoot, 'tsconfig.main.json'), 'utf8')) as {
      compilerOptions: Record<string, unknown>;
    };

    // Merge the way TypeScript's `extends` resolves options: the child overrides the parent
    // per-key, but tsconfig.main.json does not mention either strictness flag, so both must
    // still resolve `true` from the base.
    const merged: Record<string, unknown> = { ...base.compilerOptions, ...main.compilerOptions };

    expect(merged.exactOptionalPropertyTypes).toBe(true);
    expect(merged.noUncheckedIndexedAccess).toBe(true);
  });

  it('fuseSeconds matches packages/domain/tests/model.test.ts exactly (computed through the built package)', () => {
    // Published expectations, read never edited: packages/domain/tests/model.test.ts:53-59.
    expect(fuseSecondsForCdr(0)).toBe(2);
    expect(fuseSecondsForCdr(25)).toBe(1.5);
    expect(fuseSecondsForCdr(70)).toBeCloseTo(0.6, 6);
    expect(fuseSecondsForCdr(80)).toBe(FUSE_FLOOR);
  });

  it('the main bundle inlines the domain code (not externalised)', () => {
    if (!requireDesktopBundle()) return;

    const bundle = readFileSync(mainBundlePath, 'utf8');
    expect(bundle).toContain('fuseSeconds');
    expect(bundle).not.toMatch(/require\(['"]@bombfarm\/domain/);
  });

  it('the desktop bundle does not drag in the team-plan solver (AD-016 budget)', () => {
    if (!requireDesktopBundle()) return;

    const bundle = readFileSync(mainBundlePath, 'utf8');
    expect(bundle).not.toContain(TEAM_PLAN_WORKER_MARKER);
  });

  it('the renderer transpiles @bombfarm/domain', () => {
    const nextConfigText = readFileSync(resolve(desktopRoot, 'renderer/next.config.ts'), 'utf8');
    const transpileMatch = nextConfigText.match(/transpilePackages:\s*\[([^\]]*)\]/);

    expect(transpileMatch, 'expected a transpilePackages array in renderer/next.config.ts').not.toBeNull();
    expect(transpileMatch?.[1]).toMatch(/['"]@bombfarm\/domain['"]/);
  });
});
