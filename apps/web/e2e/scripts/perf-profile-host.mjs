#!/usr/bin/env node
/**
 * Captures perf against the **production-profile** build (`captureMode:
 * prod-profile`), as opposed to `perf-host.mjs`, which measures `dev-strict`.
 *
 * The two instruments answer different questions and their numbers are NOT comparable:
 *
 *   dev-strict    `next dev` + StrictMode. Renders are double-invoked and dev-only work
 *                 is included. This is the instrument the W1 baseline and every W5/W8
 *                 number is expressed in, so it is kept for continuity.
 *   prod-profile  Production React with component names retained. The only instrument
 *                 that may back a claim about production behavior.
 *
 * Requires `pnpm perf:build:profile` first — this serves the static export in `out/` and
 * does not build it. Refuses to run if that build is missing, because silently measuring
 * a stale or normal (minified) build would produce component-less rows that look like a
 * successful capture.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const outDir = path.join(process.cwd(), 'out');
if (!existsSync(outDir)) {
  console.error(
    '[perf:capture:profile] out/ is missing.\n' +
      'Run `pnpm perf:build:profile` first — this runner serves the build, it does not create it.',
  );
  process.exit(1);
}

process.env.PERF = '1';
process.env.PERF_PROFILE = '1';
process.env.E2E_PREBUILT = '1';

const extra = process.argv.slice(2);
const result = spawnSync('pnpm', ['exec', 'playwright', 'test', '--project=perf', ...extra], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});
process.exit(result.status ?? 1);
