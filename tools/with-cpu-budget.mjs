import process from 'node:process';
import { cappedWorkers } from './cpu-budget.mjs';
import { bareTokensOrExit, runBareTokens } from './shell-command.mjs';
import { npmrcWorkspaceConcurrency } from './workspace-concurrency.mjs';

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

const argv = bareTokensOrExit(process.argv.slice(2), 'with-cpu-budget');

process.env.npm_config_workspace_concurrency = String(
  cappedWorkers(npmrcWorkspaceConcurrency(), `workspace:${argv.join(' ')}`),
);

runBareTokens(argv);
