import { availableParallelism } from 'node:os';
import process from 'node:process';
import { cpuLeaseReport } from './cpu-budget.mjs';

/**
 * Prints what is currently holding a share of the machine-wide CPU budget.
 *
 * ```bash
 * node tools/cpu-budget-report.mjs
 * ```
 *
 * Its own file rather than a main-module check inside `cpu-budget.mjs`, because that module is
 * imported by `apps/web/playwright.config.ts` and Playwright transpiles a config's local imports
 * to CommonJS — where the `import.meta.url` such a check needs is a SyntaxError. Keeping the
 * library free of both `import.meta` and top-level side effects is what makes it safe to import
 * from a build or test config.
 *
 * Reading the state claims nothing, so asking what is running never changes what is running.
 */

const report = cpuLeaseReport();

const lines = [
  `budget        ${report.budget} of ${availableParallelism()} cores`,
  `lease dir     ${report.leaseDir}`,
  `sharing       ${report.sharingApplies ? 'on' : 'off (CI)'}`,
  `active runs   ${report.leases.length}`,
  `share per run ${report.leases.length ? report.sharePerRun : report.budget}`,
];

for (const lease of report.leases) {
  const ageSeconds = Math.round((Date.now() - Number(lease.startedAt)) / 1000);
  lines.push(`  pid ${lease.pid} — ${lease.kind} (${ageSeconds}s)`);
}

process.stdout.write(`${lines.join('\n')}\n`);
