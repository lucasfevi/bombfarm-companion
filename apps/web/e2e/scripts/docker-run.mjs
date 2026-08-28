#!/usr/bin/env node
/**
 * Run Playwright e2e inside Docker — same Linux Chromium stack as CI.
 *
 * Usage:
 *   node e2e/scripts/docker-run.mjs test              # smoke + visual (default)
 *   node e2e/scripts/docker-run.mjs smoke             # behavioral specs only
 *   node e2e/scripts/docker-run.mjs visual            # visual baselines only
 *   node e2e/scripts/docker-run.mjs update            # refresh changed snapshots
 *   node e2e/scripts/docker-run.mjs perf              # profiler harness (PERF=1)
 *   node e2e/scripts/docker-run.mjs build-image       # rebuild the local e2e image
 *   node e2e/scripts/docker-run.mjs shell             # interactive shell in the e2e container
 *   node e2e/scripts/docker-run.mjs test -- --grep x  # extra args after `--` → playwright
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// e2e/scripts/ → apps/web → monorepo root
const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = path.resolve(WEB_ROOT, '..', '..');
const IMAGE_NAME = 'bombfarm-companion-web-e2e';
const NODE_MODULES_VOLUME = `${IMAGE_NAME}-node-modules`;
const PNPM_STORE_VOLUME = `${IMAGE_NAME}-pnpm-store`;

const MODES = new Set(['test', 'smoke', 'visual', 'update', 'perf', 'build-image', 'shell']);

function usage(exitCode = 0) {
  const text = `Usage: node e2e/scripts/docker-run.mjs <mode> [-- playwright-args…]

Modes:
  test         Full suite — smoke + visual (same as CI)
  smoke        Behavioral specs only
  visual       Visual baseline specs only
  update       Refresh changed snapshots (review diffs before committing)
  perf         Profiler harness (dev-strict / next:dev, PERF=1 --project=perf)
  build-image  Rebuild the local Docker e2e image
  shell        Interactive bash in the e2e container

Requires Docker Desktop (or Docker Engine) running.`;
  console[exitCode ? 'error' : 'log'](text);
  process.exit(exitCode);
}

function readPlaywrightVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(WEB_ROOT, 'package.json'), 'utf8'));
  const raw = pkg.devDependencies?.['@playwright/test'] ?? pkg.dependencies?.['@playwright/test'];
  if (!raw) {
    console.error('Could not read @playwright/test version from package.json');
    process.exit(1);
  }
  const match = String(raw).match(/(\d+\.\d+\.\d+)/);
  if (!match) {
    console.error(`Unrecognized @playwright/test version: ${raw}`);
    process.exit(1);
  }
  return match[1];
}

function parseArgs(argv) {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') usage(0);
  const mode = argv[0];
  if (!MODES.has(mode)) {
    console.error(`Unknown mode: ${mode}`);
    usage(1);
  }
  let extra = [];
  const dash = argv.indexOf('--');
  if (dash >= 0) extra = argv.slice(dash + 1);
  return { mode, extra };
}

function dockerMountPath(dir) {
  const resolved = path.resolve(dir);
  if (process.platform === 'win32') {
    return resolved.replace(/\\/g, '/');
  }
  return resolved;
}

function run(cmd, args, { allowFail = false, inherit = true, cwd } = {}) {
  const result = spawnSync(cmd, args, {
    stdio: inherit ? 'inherit' : 'pipe',
    encoding: 'utf8',
    cwd,
  });
  if (result.error) {
    if (result.error.code === 'ENOENT' && cmd === 'docker') {
      console.error(
        'Docker is not available. Install Docker Desktop and ensure it is running, then retry.',
      );
      process.exit(1);
    }
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0 && !allowFail) {
    process.exit(result.status ?? 1);
  }
  return result;
}

function imageExists(tag) {
  const result = run('docker', ['image', 'inspect', tag], { allowFail: true, inherit: false });
  return result.status === 0;
}

function buildImage(tag, playwrightVersion) {
  console.log(`Building ${tag} (Playwright ${playwrightVersion}) …`);
  run('docker', [
    'build',
    '-f',
    'apps/web/e2e/Dockerfile',
    '--build-arg',
    `PLAYWRIGHT_VERSION=${playwrightVersion}`,
    '-t',
    tag,
    '.',
  ], { cwd: ROOT });
}

function ensureImage(tag, { rebuild = false } = {}) {
  if (rebuild || !imageExists(tag)) {
    buildImage(tag, readPlaywrightVersion());
  }
}

function dockerRunArgs(tag, innerCommand, { interactive = false } = {}) {
  const mount = dockerMountPath(ROOT);
  const args = ['run', '--rm'];
  if (interactive) args.push('-it');
  args.push(
    '-v',
    `${mount}:/work`,
    '-v',
    `${NODE_MODULES_VOLUME}:/work/node_modules`,
    '-v',
    `${PNPM_STORE_VOLUME}:/root/.local/share/pnpm/store`,
    '-w',
    '/work',
    '-e',
    'CI=1',
    tag,
    '/bin/bash',
    '-lc',
    innerCommand,
  );
  return args;
}

function playwrightInvocation(mode, extra) {
  const install = [
    'pnpm install --frozen-lockfile',
    'pnpm --filter @bombfarm/web exec playwright install --with-deps chromium',
  ].join(' && ');

  let testCmd;
  switch (mode) {
    case 'smoke':
      testCmd = 'pnpm --filter @bombfarm/web exec playwright test --project=smoke';
      break;
    case 'visual':
      testCmd = 'pnpm --filter @bombfarm/web exec playwright test --project=chromium';
      break;
    case 'update':
      testCmd =
        'pnpm --filter @bombfarm/web exec playwright test --project=chromium --update-snapshots=changed';
      break;
    case 'perf':
      testCmd = 'PERF=1 CI=1 pnpm --filter @bombfarm/web exec playwright test --project=perf';
      return `${install} && ${testCmd}${extra.length > 0 ? ` ${extra.map(shellQuote).join(' ')}` : ''}`;
    default:
      testCmd = 'pnpm --filter @bombfarm/web exec playwright test';
      break;
  }

  if (extra.length > 0) {
    testCmd += ` ${extra.map(shellQuote).join(' ')}`;
  }

  return `${install} && pnpm --filter @bombfarm/web build:e2e && E2E_PREBUILT=1 ${testCmd}`;
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:=+-]+$/.test(value)) return value;
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function main() {
  const { mode, extra } = parseArgs(process.argv.slice(2));
  const tag = `${IMAGE_NAME}:local`;

  if (mode === 'build-image') {
    buildImage(tag, readPlaywrightVersion());
    return;
  }

  ensureImage(tag);

  if (mode === 'shell') {
    const cmd = 'pnpm install --frozen-lockfile && exec bash';
    run('docker', dockerRunArgs(tag, cmd, { interactive: true }));
    return;
  }

  const inner = playwrightInvocation(mode, extra);
  console.log(`Running e2e in Docker (${mode}) …`);
  run('docker', dockerRunArgs(tag, inner));
}

main();
