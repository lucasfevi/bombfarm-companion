#!/usr/bin/env node
/**
 * Host-OS iteration runner for the MOD-33 perf project (not the capture source of truth).
 * Sets PERF=1 and forwards args to Playwright. Prefer `pnpm perf:capture` (Docker) for baselines.
 */
import { spawnSync } from 'node:child_process';

process.env.PERF = '1';
const extra = process.argv.slice(2);
const result = spawnSync(
  'pnpm',
  ['exec', 'playwright', 'test', '--project=perf', ...extra],
  { stdio: 'inherit', env: process.env, shell: true },
);
process.exit(result.status ?? 1);
