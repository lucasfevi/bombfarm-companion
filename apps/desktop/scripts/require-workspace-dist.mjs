import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** `packages/`, resolved from `apps/desktop/scripts`. */
export const PACKAGES_ROOT = join(here, '..', '..', '..', 'packages');

/**
 * The workspace packages whose `dist/` this vitest project genuinely needs, measured by
 * removing each package's `dist` in turn and running `pnpm vitest run --project
 * @bombfarm/desktop`: without all four the suite fails at collection, and with only these four
 * it is fully green (43 files / 646 tests) even when `ui` and `pricing` are unbuilt.
 *
 * Keep in sync with `apps/desktop`'s own `prebuild` script, which builds the same set (plus
 * `ui`, which the bundle needs but these tests do not).
 */
export const REQUIRED_DIST_PACKAGES = ['contracts', 'domain', 'game-api', 'game-data'];

/**
 * Every entry of {@link REQUIRED_DIST_PACKAGES} whose `dist/` is absent, in declaration order.
 *
 * @param {string} [packagesRoot] Path to check under. Injectable so the guard's own test never
 *   has to touch real build output.
 * @returns {string[]}
 */
export function missingDistPackages(packagesRoot = PACKAGES_ROOT) {
  return REQUIRED_DIST_PACKAGES.filter((name) => !existsSync(join(packagesRoot, name, 'dist')));
}

/**
 * These packages publish their entry points from `dist/` (`packages/domain`'s `exports` map,
 * for one, points every subpath at `./dist/**`), and this vitest project is the only one that
 * resolves them through those real `exports` maps — `apps/web` and `packages/domain` alias
 * `@bombfarm/domain` to `src/`, so they never need a build. Here the builds are a hard
 * prerequisite: without them every desktop file that imports one of these subpaths dies at
 * collection with `Cannot find package '@bombfarm/<pkg>/<subpath>'`, which points nowhere near
 * the actual fix. CI hides this because `.github/workflows/ci-desktop.yml` builds the workspace
 * packages before the unit step; it is a local-developer trap only.
 *
 * All four are checked, and all missing ones are named at once, deliberately. Checking only
 * `domain` is not enough: with `domain/dist` present but `contracts`/`game-api`/`game-data`
 * unbuilt the guard hands back a false all-clear and the suite still dies at collection with
 * the same opaque errors — measured, 20+ files failing while the summary reads
 * `Tests 292 passed` with zero failures.
 *
 * This throws. Unlike `apps/web`'s `requireBuildOutput` — a multi-minute `next build`, tolerated
 * as a local skip — the prerequisite here is a handful of fast package builds, so there is no
 * reason to tolerate its absence. Same posture as `packages/domain/tests/helpers/require-dist.ts`:
 * a silent skip would hand back a green run in which dozens of files never executed, which is
 * the failure mode this repo keeps hitting.
 *
 * @param {string} [packagesRoot] Path to check under. Injectable, as above.
 * @returns {void}
 */
export function assertWorkspaceDistBuilt(packagesRoot = PACKAGES_ROOT) {
  const missing = missingDistPackages(packagesRoot);
  if (missing.length === 0) return;

  const paths = missing.map((name) => `  - ${join(packagesRoot, name, 'dist')}`).join('\n');

  throw new Error(
    '[require-workspace-dist] the @bombfarm/desktop vitest project cannot resolve its workspace ' +
      `packages — ${missing.length} required build output(s) are missing:\n${paths}\n` +
      'Run `pnpm build` first.\n' +
      'Why: these packages publish their entry points from ./dist/**, and this is the one ' +
      'vitest project that resolves them through their `exports` maps rather than aliasing to ' +
      'src/. Failing here on purpose: without the build these tests do not fail, they never run.',
  );
}

/**
 * Vitest `globalSetup` hook — runs once before collection, so the message above replaces the
 * collection errors instead of arriving after them.
 */
export function setup() {
  assertWorkspaceDistBuilt();
}
