import { existsSync } from 'node:fs';

/**
 * Guard for assertions that can only run against real `pnpm --filter @bombfarm/web build`
 * output (`apps/web/out`).
 *
 * These byte-level tests are the only proof that a chunk actually shipped — a source-level
 * assertion cannot see what webpack emitted. But they need a build to exist, and a plain
 * `vitest run` in a clean working tree has none.
 *
 * The trap this helper closes: a bare `if (!existsSync(out)) return` reports **green** when
 * the build is missing, so the suite passes without executing the assertion it exists to
 * make. That is exactly what happened to `team-plan-worker-bundle.test.ts` — CI ran the web
 * unit tests before the build step, so the worker-chunk assertion took the silent-skip
 * branch on every run and never verified anything.
 *
 * So: skipping is a local-developer convenience only. Under `CI`, a missing build is a hard
 * failure — it means the workflow ordering regressed, and we want that loud rather than
 * quietly green.
 */

/** GitHub Actions sets `CI=true`; be liberal about what other runners set. */
function isCi(): boolean {
  const raw = process.env.CI;
  if (raw === undefined || raw === '') return false;
  const normalized = raw.toLowerCase();
  return normalized !== '0' && normalized !== 'false';
}

/**
 * Returns `true` when the build output is present and the caller should assert against it.
 *
 * Returns `false` (with a visible console note) only outside CI. Inside CI it throws, failing
 * the test, because a missing build means the pipeline is no longer running the build before
 * this suite.
 */
export function requireBuildOutput(outRoot: string, assertion: string): boolean {
  if (existsSync(outRoot)) return true;

  if (isCi()) {
    throw new Error(
      `[build-output] ${outRoot} is missing in CI, so "${assertion}" cannot run.\n` +
        'This assertion needs `pnpm --filter @bombfarm/web build` to have run FIRST. Check the ' +
        'step order in .github/workflows/ci-web.yml — the build step must precede the web unit ' +
        'tests. Failing loudly instead of skipping: a silent skip here is how this assertion ' +
        'went unexecuted for the whole of the roster-gear-optimizer epic.',
    );
  }

  console.info(
    `[build-output] ${outRoot} absent — skipping "${assertion}". ` +
      'Run `pnpm --filter @bombfarm/web build` to exercise it locally. (This skip is ' +
      'local-only; in CI a missing build fails the test.)',
  );
  return false;
}

/**
 * `pnpm perf:build:profile` (RES-05) leaves a marker in `out/`. That build disables
 * minification, so webpack keeps exports it would otherwise drop — byte-level exclusion
 * assertions report phantom regressions against it, and it is never deployed.
 *
 * Tolerated locally, rejected in CI: no workflow runs a profile build before the unit
 * suite, so seeing one there means the pipeline changed under us.
 */
export function isPerfProfileBuild(outRoot: string, assertion: string): boolean {
  if (!existsSync(`${outRoot}/.perf-profile-build`)) return false;

  if (isCi()) {
    throw new Error(
      `[build-output] ${outRoot} holds a perf-profile build in CI, so "${assertion}" cannot ` +
        'run against shippable output. No workflow should produce one before the unit suite — ' +
        'check .github/workflows/ci-web.yml.',
    );
  }

  console.info(
    `[build-output] ${outRoot} is a perf-profile build (unminified) — skipping "${assertion}". ` +
      'Re-run `pnpm --filter @bombfarm/web build` for a shippable export.',
  );
  return true;
}
