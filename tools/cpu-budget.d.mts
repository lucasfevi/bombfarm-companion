/**
 * Types for `cpu-budget.mjs`, which is plain JS because `tools/with-cpu-budget.mjs` and the
 * `node tools/cpu-budget.mjs` diagnostic run it directly under Node, with no TypeScript
 * loader in front. `apps/web/tsconfig.json` sets `allowJs: false` and typechecks
 * `playwright.config.ts`, so that importer needs declarations rather than inference.
 *
 * Hand-written declarations can drift from the module they describe without anything failing;
 * `cpu-budget.test.mjs` compares this file's exported names against the module's own.
 */

export interface CpuLease {
  pid: number;
  kind: string;
  startedAt: number;
}

export interface CpuLeaseReport {
  budget: number;
  leaseDir: string;
  sharingApplies: boolean;
  leases: CpuLease[];
  sharePerRun: number;
}

export declare function machineCpuBudget(): number;

export declare function cappedWorkers(cap: number, kind: string): number;

export declare function cpuLeaseReport(): CpuLeaseReport;
