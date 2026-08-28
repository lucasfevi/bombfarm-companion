import { spawnSync } from 'node:child_process';
import esbuild from 'esbuild';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cappedWorkers, cpuLeaseReport, machineCpuBudget } from './cpu-budget.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Every test runs against its own lease directory, so a suite running while a real build holds
 * a real lease still sees only what it wrote itself.
 */
let leaseDir;
const savedEnv = {};

function saveEnv(...names) {
  for (const name of names) savedEnv[name] = process.env[name];
}

function writeLease(name, lease) {
  writeFileSync(path.join(leaseDir, `${name}.json`), JSON.stringify(lease), 'utf8');
}

/** A pid that really lived and really died — a fabricated one could collide with a live process. */
function deadPid() {
  const { pid } = spawnSync(process.execPath, ['-e', '']);
  return pid;
}

function leaseFiles() {
  try {
    return readdirSync(leaseDir).filter((entry) => entry.endsWith('.json'));
  } catch {
    return [];
  }
}

beforeEach(() => {
  saveEnv('BFC_CPU_LEASE_DIR', 'BFC_CPU_LEASE', 'BFC_CPU_BUDGET', 'CI');
  leaseDir = mkdtempSync(path.join(tmpdir(), 'bfc-cpu-budget-test-'));
  process.env.BFC_CPU_LEASE_DIR = leaseDir;
  // Vitest itself claimed a lease when it loaded `vitest.workers.ts`; this process must look
  // unclaimed so the tests below exercise claiming rather than inheritance.
  delete process.env.BFC_CPU_LEASE;
  delete process.env.CI;
});

afterEach(() => {
  for (const [name, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  rmSync(leaseDir, { recursive: true, force: true });
});

describe('machineCpuBudget', () => {
  it('defaults to a third of the machine, so two thirds stay free for everything else', () => {
    delete process.env.BFC_CPU_BUDGET;
    expect(machineCpuBudget()).toBe(Math.max(2, Math.round(availableParallelism() / 3)));
  });

  it('never drops below 2, so a small machine still divides rather than serialising', () => {
    delete process.env.BFC_CPU_BUDGET;
    expect(machineCpuBudget()).toBeGreaterThanOrEqual(2);
  });

  it('is overridable, so a machine dedicated to this work can raise it', () => {
    process.env.BFC_CPU_BUDGET = '16';
    expect(machineCpuBudget()).toBe(16);
  });

  it('ignores an unusable override rather than starving every run', () => {
    process.env.BFC_CPU_BUDGET = 'plenty';
    expect(machineCpuBudget()).toBe(Math.max(2, Math.round(availableParallelism() / 3)));
  });
});

describe('cappedWorkers', () => {
  it('gives a run that has the machine to itself its full cap', () => {
    process.env.BFC_CPU_BUDGET = '8';
    expect(cappedWorkers(3, 'vitest')).toBe(3);
  });

  it('never exceeds the caller’s own cap, however wide the budget', () => {
    process.env.BFC_CPU_BUDGET = '64';
    expect(cappedWorkers(3, 'vitest')).toBe(3);
  });

  it('divides the budget among the runs that are actually executing', () => {
    process.env.BFC_CPU_BUDGET = '8';
    writeLease('other-a', { pid: process.pid, kind: 'next:build', startedAt: Date.now() });
    writeLease('other-b', { pid: process.pid, kind: 'workspace:lint', startedAt: Date.now() });
    // Three live runs (two above plus this one) sharing 8 -> 2 each, under the cap of 3.
    expect(cappedWorkers(3, 'vitest')).toBe(2);
  });

  it('still yields one worker when the budget is thinner than the number of runs', () => {
    process.env.BFC_CPU_BUDGET = '2';
    for (let index = 0; index < 6; index += 1) {
      writeLease(`other-${index}`, { pid: process.pid, kind: 'vitest', startedAt: Date.now() });
    }
    expect(cappedWorkers(3, 'vitest')).toBe(1);
  });

  it('counts a run that left its lease behind as gone, not as a share holder', () => {
    process.env.BFC_CPU_BUDGET = '8';
    writeLease('killed', { pid: deadPid(), kind: 'vitest', startedAt: Date.now() });
    expect(cappedWorkers(3, 'vitest')).toBe(3);
    expect(leaseFiles()).not.toContain('killed.json');
  });

  it('drops a lease older than the staleness backstop, in case its pid was recycled', () => {
    process.env.BFC_CPU_BUDGET = '8';
    const sevenHoursAgo = Date.now() - 7 * 60 * 60 * 1000;
    writeLease('recycled', { pid: process.pid, kind: 'vitest', startedAt: sevenHoursAgo });
    expect(cappedWorkers(3, 'vitest')).toBe(3);
    expect(leaseFiles()).not.toContain('recycled.json');
  });

  it('drops a lease it cannot parse instead of trusting or crashing on it', () => {
    process.env.BFC_CPU_BUDGET = '8';
    writeFileSync(path.join(leaseDir, 'torn.json'), '{ half-written', 'utf8');
    expect(cappedWorkers(3, 'vitest')).toBe(3);
    expect(leaseFiles()).not.toContain('torn.json');
  });

  it('records what holds the share, so the diagnostic can name it', () => {
    process.env.BFC_CPU_BUDGET = '8';
    cappedWorkers(3, 'vitest');
    const written = leaseFiles();
    expect(written).toHaveLength(1);
    const lease = JSON.parse(readFileSync(path.join(leaseDir, written[0]), 'utf8'));
    expect(lease).toMatchObject({ pid: process.pid, kind: 'vitest' });
  });

  it('reuses an inherited lease, so nesting a build inside a build is one run and not two', () => {
    process.env.BFC_CPU_BUDGET = '8';
    process.env.BFC_CPU_LEASE = '4242';
    writeLease('4242', { pid: process.pid, kind: 'workspace:build', startedAt: Date.now() });
    expect(cappedWorkers(4, 'next:build')).toBe(4);
    expect(leaseFiles()).toEqual(['4242.json']);
  });

  it('falls back to the plain cap when the lease directory cannot be used', () => {
    process.env.BFC_CPU_BUDGET = '8';
    // A file where the directory should be: every write and read against it fails.
    const blocked = path.join(leaseDir, 'blocked');
    writeFileSync(blocked, 'not a directory', 'utf8');
    process.env.BFC_CPU_LEASE_DIR = path.join(blocked, 'leases');
    expect(cappedWorkers(3, 'vitest')).toBe(3);
  });

  it('is bypassed under CI, where a runner has nobody to share with', () => {
    process.env.CI = '1';
    process.env.BFC_CPU_BUDGET = '2';
    writeLease('other', { pid: process.pid, kind: 'vitest', startedAt: Date.now() });
    expect(cappedWorkers(4, 'next:build')).toBe(4);
    expect(process.env.BFC_CPU_LEASE).toBeUndefined();
  });
});

describe('cpuLeaseReport', () => {
  it('claims nothing, so asking what is running does not change what is running', () => {
    process.env.BFC_CPU_BUDGET = '8';
    const report = cpuLeaseReport();
    expect(report.leases).toEqual([]);
    expect(leaseFiles()).toEqual([]);
    expect(report.budget).toBe(8);
  });

  /**
   * The pre-push hygiene sweep matches `bombfarm-` followed by anything that is not
   * `companion`. A shorter lease-directory name matched it on every run, burying real hits
   * under a permanent false positive.
   */
  it('names the default lease directory so the pre-push hygiene sweep stays quiet', () => {
    delete process.env.BFC_CPU_LEASE_DIR;
    expect(cpuLeaseReport().leaseDir).not.toMatch(/bombfarm-(?!companion)[a-z]/);
  });

  it('reports the share each active run is entitled to', () => {
    process.env.BFC_CPU_BUDGET = '8';
    writeLease('a', { pid: process.pid, kind: 'vitest', startedAt: Date.now() });
    writeLease('b', { pid: process.pid, kind: 'next:build', startedAt: Date.now() });
    const report = cpuLeaseReport();
    expect(report.leases).toHaveLength(2);
    expect(report.sharePerRun).toBe(4);
  });
});

describe('importability from a Playwright config', () => {
  /**
   * Playwright transpiles a config's local imports to CommonJS, where `import.meta` is a
   * SyntaxError. A main-module check at the bottom of the module was enough to break every e2e
   * job with `Cannot use 'import.meta' outside a module` — while `pnpm build`, `pnpm typecheck`,
   * `pnpm lint` and `pnpm test` all stayed green, because none of them load a Playwright config.
   * The diagnostic lives in `cpu-budget-report.mjs` for this reason.
   */
  /**
   * Transformed rather than grepped. A text search cannot tell the hazard from the header comment
   * warning about it, and it would keep passing if the transform's rules ever changed. esbuild's
   * CJS transform reports the same construct Playwright's loader chokes on.
   */
  async function cjsTransformWarnings(source) {
    const { warnings } = await esbuild.transform(source, {
      format: 'cjs',
      platform: 'node',
      loader: 'js',
    });
    return warnings.map((warning) => warning.text);
  }

  it('survives the ESM-to-CommonJS transform a Playwright config loader applies', async () => {
    const source = readFileSync(path.join(HERE, 'cpu-budget.mjs'), 'utf8');
    expect(await cjsTransformWarnings(source)).toEqual([]);
  });

  it('would have caught the regression — the same transform flags import.meta', async () => {
    const warnings = await cjsTransformWarnings('export const a = 1;\nif (import.meta.url) {}');
    expect(warnings.join(' ')).toContain('import.meta');
  });

  /**
   * Top-level side effects would run inside Playwright's config loader, and inside every worker
   * that re-loads the config. Claiming a share must stay something a caller asks for.
   */
  it('does nothing on import until a caller asks for a share', () => {
    // A fresh process, because this file imported the module before any test ran.
    const moduleUrl = pathToFileURL(path.join(HERE, 'cpu-budget.mjs')).href;
    const childEnv = { ...process.env, BFC_CPU_LEASE_DIR: leaseDir };
    delete childEnv.BFC_CPU_LEASE;
    delete childEnv.CI;
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import ${JSON.stringify(moduleUrl)};\nprocess.stdout.write(String(process.env.BFC_CPU_LEASE ?? 'none'));`,
      ],
      { encoding: 'utf8', env: childEnv },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('none');
    expect(leaseFiles()).toEqual([]);
  });
});

describe('cpu-budget.d.mts', () => {
  /**
   * The declarations are hand-written because the module is plain JS that Node runs directly,
   * and `apps/web/playwright.config.ts` typechecks under `allowJs: false`. Nothing else notices
   * when an export is added, renamed, or removed on one side only.
   */
  it('declares exactly the module’s runtime exports', async () => {
    const declarations = readFileSync(path.join(HERE, 'cpu-budget.d.mts'), 'utf8');
    const declared = [...declarations.matchAll(/^export declare (?:function|const) (\w+)/gm)].map(
      (match) => match[1],
    );
    const runtime = Object.keys(await import('./cpu-budget.mjs'));
    expect(declared.sort()).toEqual(runtime.sort());
  });
});
