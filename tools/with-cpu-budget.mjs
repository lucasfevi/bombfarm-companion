import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { cappedWorkers } from './cpu-budget.mjs';

/**
 * Run a `pnpm -r` command with its workspace concurrency taken from the machine-wide budget
 * rather than from `.npmrc` alone — see `cpu-budget.mjs` for why one run's cap is not enough.
 *
 * A wrapper rather than a config value because `.npmrc` is static and the share is not: it
 * depends on what else is running at the moment the command starts. pnpm reads every setting
 * from `npm_config_*` as well as from `.npmrc`, and the environment wins, so setting the
 * variable here is the whole mechanism.
 *
 * `pnpm -r typecheck` and `pnpm -r lint` are the reason this exists at all. Each concurrent
 * workspace runs a whole TypeScript program — `eslint.config.mjs` sets `projectService: true`,
 * so every parallel `eslint` holds its own type information beside every parallel `tsc --noEmit`
 * — and it is memory, not CPU, that makes several of those at once hurt.
 */

const NPMRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.npmrc');

/**
 * The static ceiling stays in `.npmrc` and is read back here, so a bare `pnpm -r` typed by hand
 * is bounded by the same number this wrapper starts from. Two copies of it would drift.
 */
function npmrcWorkspaceConcurrency() {
  try {
    const match = /^workspace-concurrency\s*=\s*(\d+)\s*$/m.exec(readFileSync(NPMRC, 'utf8'));
    const value = Number(match?.[1]);
    return Number.isFinite(value) && value >= 1 ? value : 1;
  } catch {
    return 1;
  }
}

/**
 * The child has to go through a shell, because on Windows `pnpm` is a `.cmd` shim that
 * `CreateProcess` cannot exec directly. Passing an args array alongside `shell` concatenates it
 * unescaped — that is Node's DEP0190 warning, and it really does mangle arguments (`node -e
 * "a b"` arrived as `bad option: -,`). So the command line is built here instead, and anything
 * that would need quoting to survive the trip is refused rather than silently corrupted.
 *
 * Every call site passes bare tokens (`pnpm -r build`), so this rejects nothing in practice —
 * it is here so that a later call site with a quoted argument fails loudly at the first run
 * instead of running something subtly different from what it reads like.
 */
const SHELL_SAFE_TOKEN = /^[A-Za-z0-9._@:=/\\-]+$/;

const argv = process.argv.slice(2);

if (argv.length === 0) {
  process.stderr.write('usage: node tools/with-cpu-budget.mjs <command> [args...]\n');
  process.exit(2);
}

const unsafe = argv.filter((token) => !SHELL_SAFE_TOKEN.test(token));
if (unsafe.length > 0) {
  process.stderr.write(
    `with-cpu-budget: refusing to shell-quote ${JSON.stringify(unsafe)}. ` +
      'Pass bare tokens, or run the command directly and set npm_config_workspace_concurrency yourself.\n',
  );
  process.exit(2);
}

process.env.npm_config_workspace_concurrency = String(
  cappedWorkers(npmrcWorkspaceConcurrency(), `workspace:${argv.join(' ')}`),
);

const child = spawn(argv.join(' '), { stdio: 'inherit', shell: true });

child.on('error', (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  // Signal deaths must stay signal deaths, or Ctrl-C reads to the caller as a plain failure.
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
