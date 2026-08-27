import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** `packages/`, resolved from `tools/`. */
export const PACKAGES_ROOT = join(here, '..', 'packages');

/**
 * Per-vitest-project list of the workspace packages whose `dist/` that project genuinely needs,
 * keyed by the project's vitest `name` (the package.json name, or the directory name for `tools`,
 * which has no manifest).
 *
 * Every list is **measured**, not assumed, by moving each `packages/<name>/dist` aside in turn and
 * running that project alone (`pnpm vitest run --project <name>`):
 *
 * - `@bombfarm/desktop` — `contracts`, `domain`, `game-api`, `game-data`, `tap-runtime`. Measured
 *   for `tap-runtime` by moving its `dist/` aside: `runtime.test.ts` fails at collection with
 *   `Failed to resolve entry for package "@bombfarm/tap-runtime"`. Without all five the
 *   suite fails at collection; with only these four it is fully green (43 files / 653 tests) even
 *   when `ui` and `pricing` are unbuilt (re-confirmed for this extraction). Keep in sync with
 *   `apps/desktop`'s own `prebuild` script, which builds the same set plus `ui`, which the bundle
 *   needs but these tests do not.
 * - `@bombfarm/game-api` — `domain` only. Removing `domain/dist` fails 5 of its 14 files at
 *   collection (`client`, `domain-edge`, `fingerprints`, `routes`, `shape`) — 203 tests drop to
 *   131 with zero reported failures in the summary line. Removing any of `contracts`, `game-api`,
 *   `game-data`, `pricing`, `ui` leaves it green at 14 files / 203 tests. `contracts` looks like a
 *   dependency and is not: every `@bombfarm/contracts` specifier under `packages/game-api/src` is
 *   an `import type`, erased before it can be resolved.
 * - `tools` — `domain` and `game-api`, each needed by exactly ONE of the project's 34 files, and
 *   not the same one. Removing `domain/dist` fails `advice-change-key-coverage.test.mjs` at
 *   collection (it pulls in `apps/desktop/renderer/lib/planning/hero-advice.ts`, which imports
 *   `@bombfarm/domain/account-fidelity` and `/roster-dps`). Removing `game-api/dist` instead fails
 *   `derived-fixture-drift.test.mjs` at collection — it imports
 *   `packages/game-api/scripts/generate-domain-fixtures.mjs`, which resolves `../dist/assemble.js`
 *   etc. by relative path (never through `@bombfarm/game-api`'s own exports map), and that chain
 *   also reaches `@bombfarm/domain/wiki-assets`, so `domain/dist` is required for this file too.
 *   Removing any other package's `dist` leaves the project green. Because the need is one-file-wide
 *   per entry, this project calls the assert per-file instead of as `globalSetup`; the entries stay
 *   here because those calls still read them. See `tools/vitest.config.ts`.
 *
 * A short list here is worse than no guard: an earlier revision checked `domain` alone for the
 * desktop project and handed back a false all-clear while 20+ files still died at collection.
 * Re-measure when a project gains an import of a new workspace package.
 */
export const REQUIRED_DIST_PACKAGES = Object.freeze({
  '@bombfarm/desktop': Object.freeze(['contracts', 'domain', 'game-api', 'game-data', 'tap-runtime']),
  '@bombfarm/game-api': Object.freeze(['domain']),
  tools: Object.freeze(['domain', 'game-api']),
});

/**
 * The measured list for `project`.
 *
 * Throws for a project with no declared list rather than defaulting to `[]`: a new vitest project
 * that wires this guard up without measuring its own list would otherwise get a permanent silent
 * all-clear, which is the failure shape this whole module exists to prevent.
 *
 * @param {string} project Vitest project name.
 * @returns {readonly string[]}
 */
export function requiredDistPackages(project) {
  const required = Object.hasOwn(REQUIRED_DIST_PACKAGES, project)
    ? REQUIRED_DIST_PACKAGES[project]
    : undefined;
  if (required) return required;

  throw new Error(
    `[require-workspace-dist] no required-dist list is declared for the vitest project ` +
      `"${project}". Measure which packages/<name>/dist it needs (move each aside in turn and ` +
      `run \`pnpm vitest run --project ${project}\`) and add the result to ` +
      'REQUIRED_DIST_PACKAGES in tools/require-workspace-dist.mjs. Known projects: ' +
      `${Object.keys(REQUIRED_DIST_PACKAGES).join(', ')}.`,
  );
}

/**
 * Every package `project` requires whose `dist/` is absent, in declaration order.
 *
 * @param {string} project Vitest project name.
 * @param {string} [packagesRoot] Path to check under. Injectable so the guard's own test never
 *   has to touch real build output.
 * @returns {string[]}
 */
export function missingDistPackages(project, packagesRoot = PACKAGES_ROOT) {
  return requiredDistPackages(project).filter(
    (name) => !existsSync(join(packagesRoot, name, 'dist')),
  );
}

/**
 * The entry point for both wirings: `globalSetup` for the two project-wide consumers, and a
 * direct top-level call for the one per-file consumer (`tools/advice-change-key-coverage.test.mjs`).
 *
 * These packages publish their entry points from `dist/` (`packages/domain`'s `exports` map, for
 * one, points every subpath at `./dist/**`), and the three projects listed in
 * {@link REQUIRED_DIST_PACKAGES} resolve them through those real `exports` maps — `apps/web` and
 * `packages/domain` alias `@bombfarm/domain` to `src/`, so they never need a build and are
 * deliberately not listed here. For the three that do, the builds are a hard prerequisite:
 * without them every file that imports one of these subpaths dies at collection with
 * `Cannot find package '@bombfarm/<pkg>/<subpath>'`, which points nowhere near the actual fix. CI
 * hides this because `.github/workflows/ci-desktop.yml` builds the workspace packages before the
 * unit step; it is a local-developer trap only.
 *
 * All required packages are checked and all missing ones are named at once, deliberately: a guard
 * that stops at the first miss, or that checks a subset, hands back an all-clear while the suite
 * still dies at collection with the same opaque errors.
 *
 * This throws. Unlike `apps/web`'s `requireBuildOutput` — a multi-minute `next build`, tolerated
 * as a local skip — the prerequisite here is a handful of fast package builds, so there is no
 * reason to tolerate its absence. Same posture as `packages/domain/tests/helpers/require-dist.ts`:
 * a silent skip would hand back a green run in which dozens of files never executed, which is the
 * failure mode this repo keeps hitting.
 *
 * @param {string} project Vitest project name — named in the message, since three projects share
 *   this code and the required lists differ between them.
 * @param {string} [packagesRoot] Path to check under. Injectable, as above.
 * @returns {void}
 */
export function assertWorkspaceDistBuilt(project, packagesRoot = PACKAGES_ROOT) {
  const missing = missingDistPackages(project, packagesRoot);
  if (missing.length === 0) return;

  const paths = missing.map((name) => `  - ${join(packagesRoot, name, 'dist')}`).join('\n');

  throw new Error(
    `[require-workspace-dist] the ${project} vitest project cannot resolve its workspace ` +
      `packages — ${missing.length} required build output(s) are missing:\n${paths}\n` +
      'Run `pnpm build` first.\n' +
      'Why: these packages publish their entry points from ./dist/**, and this vitest project ' +
      'resolves them through their `exports` maps rather than aliasing to src/. Failing here ' +
      'on purpose: without the build these tests do not fail, they never run.',
  );
}

/**
 * The vitest project name carried by a `globalSetup` context.
 *
 * Vitest 3 passes the `TestProject` itself as the `setup(...)` argument (`GlobalSetupContext =
 * TestProject` in `vitest/dist/node.d.ts`), so the project identifies itself and no per-project
 * wrapper module is needed. Throws when the name is missing rather than guessing: an unnamed
 * context means the assumption above stopped holding, and silently skipping the check would be
 * the false all-clear again.
 *
 * @param {{ name?: string } | undefined} context
 * @returns {string}
 */
export function projectNameOf(context) {
  const name = context?.name;
  if (typeof name === 'string' && name.length > 0) return name;

  throw new Error(
    '[require-workspace-dist] the vitest globalSetup context carried no project name, so the ' +
      'required-dist list cannot be selected. Vitest 3 passes the TestProject as the setup() ' +
      'argument; if that changed, this guard needs updating rather than skipping — see ' +
      'tools/require-workspace-dist.mjs.',
  );
}

/**
 * Vitest `globalSetup` hook — runs once per project before collection, so the message above
 * replaces the collection errors instead of arriving after them.
 *
 * Wired into `apps/desktop/vitest.config.ts` and `packages/game-api/vitest.config.ts`, both
 * pointing at this one module. Deliberately NOT wired into `tools/vitest.config.ts`: a
 * project-wide hook there fires in `.github/workflows/line-endings.yml`, which runs
 * `pnpm vitest run --project tools line-endings` build-free by design — `globalSetup` runs per
 * project regardless of the filename filter. That project calls {@link assertWorkspaceDistBuilt}
 * directly from its one build-dependent file instead.
 *
 * @param {{ name?: string }} context The vitest `TestProject`.
 * @returns {void}
 */
export function setup(context) {
  assertWorkspaceDistBuilt(projectNameOf(context));
}
