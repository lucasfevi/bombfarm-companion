import process from 'node:process';
import { waitForHeavySlot } from './cpu-budget.mjs';
import { bareTokensOrExit, runBareTokens } from './shell-command.mjs';

/**
 * Run a command that owes the machine-wide heavy-run slot — the unscoped Vitest suite, in
 * practice — waiting for whoever holds it first. See `waitForHeavySlot` in `cpu-budget.mjs` for
 * why a full run queues where everything else shares.
 *
 * The Playwright suites take the slot from inside their own configs instead, because the
 * documented way to run them (`pnpm --filter @bombfarm/web exec playwright test …`) never goes
 * through a root script this wrapper could sit in front of.
 */

const argv = bareTokensOrExit(process.argv.slice(2), 'with-heavy-slot');

waitForHeavySlot(argv.join(' '));

runBareTokens(argv);
