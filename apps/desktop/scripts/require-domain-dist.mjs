import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** `packages/domain/dist`, resolved from `apps/desktop/scripts`. */
export const DOMAIN_DIST_ROOT = join(here, '..', '..', '..', 'packages', 'domain', 'dist');

/**
 * `packages/domain/package.json` maps every export subpath at `./dist/**`, and this vitest
 * project is the only one that resolves `@bombfarm/domain` through that real `exports` map —
 * `apps/web`, `packages/domain` and friends alias the package to `src/`, so they never need a
 * build. Here, a missing `packages/domain/dist` is a hard prerequisite, not an optional
 * artifact: without it every desktop file that imports a domain subpath dies at collection
 * with `Cannot find package '@bombfarm/domain/<subpath>'`, which points nowhere near the
 * actual fix. CI hides this because `.github/workflows/ci-desktop.yml` builds the workspace
 * packages before the unit step; it is a local-developer trap only.
 *
 * This throws, deliberately. Unlike `apps/web`'s `requireBuildOutput` — a multi-minute
 * `next build`, tolerated as a local skip — the prerequisite here is one fast package build,
 * so there is no reason to tolerate its absence. Same posture as
 * `packages/domain/tests/helpers/require-dist.ts`: a silent skip would hand back a green run
 * in which dozens of files never executed, which is the failure mode this repo keeps hitting.
 *
 * @param {string} [distRoot] Path to check. Injectable so the guard's own test never has to
 *   touch real build output.
 * @returns {void}
 */
export function assertDomainDistBuilt(distRoot = DOMAIN_DIST_ROOT) {
  if (existsSync(distRoot)) return;

  throw new Error(
    `[require-domain-dist] ${distRoot} is missing, so the @bombfarm/desktop vitest project ` +
      'cannot resolve @bombfarm/domain.\n' +
      'Run `pnpm build` first — or, faster, `pnpm --filter @bombfarm/domain build`.\n' +
      "Why: packages/domain's `exports` map points every subpath at ./dist/**, and this is the " +
      'one vitest project that resolves the package through it rather than aliasing to src/. ' +
      'Failing here on purpose: without the build these tests do not fail, they never run.',
  );
}

/**
 * Vitest `globalSetup` hook — runs once before collection, so the message above replaces the
 * collection errors instead of arriving after them.
 */
export function setup() {
  assertDomainDistBuilt();
}
