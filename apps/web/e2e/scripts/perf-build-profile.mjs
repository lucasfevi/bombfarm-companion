#!/usr/bin/env node
/**
 * Build the perf *measurement* bundle.
 *
 * `next build --profile` swaps in React's profiling build so the Profiler API reports in
 * production. On its own that is not enough for this harness: SWC still mangles function
 * names, and every row of the capture is keyed on `componentKey` (the component's name).
 * That is precisely why W1's spike rejected production-profile and locked the baseline to
 * `dev-strict`, which measures dev + StrictMode double-invoke rather than production.
 *
 * `PERF_PROFILE=1` makes `next.config.ts` disable minification for this build only, which
 * retains the names. Runtime semantics are unchanged — still production React, no dev
 * warnings, no StrictMode double-render.
 *
 * Output is a measurement artifact, never a shipped one. Do not judge bundle size from
 * it; use a normal `pnpm build` for that.
 *
 * Exists as a script (rather than an inline env assignment in package.json) because
 * `VAR=value cmd` is not portable to Windows shells, matching the other e2e helpers.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const result = spawnSync('next', ['build', '--profile'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PERF_PROFILE: '1' },
});

if (result.status === 0) {
  // Stamp the output so other checks can tell this apart from a shipped build.
  // Without minification, webpack keeps unused exports it would normally drop — so this
  // build legitimately contains code (e.g. zustand's devtools) that a real production
  // build does not. `src/tests/devtools-not-in-production-bundle.test.ts` reads this
  // marker instead of reporting a false regression.
  const outDir = path.join(process.cwd(), 'out');
  if (existsSync(outDir)) {
    writeFileSync(
      path.join(outDir, '.perf-profile-build'),
      'Measurement build from `pnpm perf:build:profile` (unminified, names retained).\n' +
        'Never deploy this directory. Run `pnpm build` for a shippable export.\n',
    );
  }
}

process.exit(result.status ?? 1);
