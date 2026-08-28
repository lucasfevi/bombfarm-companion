import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const WRAPPER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'with-cpu-budget.mjs');

/** Printed by the probe below, so the test reads what pnpm would have read. */
const PROBE = "process.stdout.write(String(process.env.npm_config_workspace_concurrency));\n";

let workDir;
let leaseDir;

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'bfc-wrapper-test-'));
  leaseDir = path.join(workDir, 'leases');
  writeFileSync(path.join(workDir, 'probe.mjs'), PROBE, 'utf8');
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function holdLeases(count) {
  mkdirSync(leaseDir, { recursive: true });
  for (let index = 0; index < count; index += 1) {
    writeFileSync(
      path.join(leaseDir, `held-${index}.json`),
      JSON.stringify({ pid: process.pid, kind: 'vitest', startedAt: Date.now() }),
      'utf8',
    );
  }
}

/** The probe runs from `workDir`, so the wrapper only ever sees bare filename tokens. */
function runWrapper(args, env = {}) {
  const childEnv = { ...process.env, BFC_CPU_LEASE_DIR: leaseDir, ...env };
  // Vitest holds a lease of its own; the wrapper has to look like a fresh top-level run.
  delete childEnv.BFC_CPU_LEASE;
  delete childEnv.CI;
  return spawnSync(process.execPath, [WRAPPER, ...args], {
    cwd: workDir,
    encoding: 'utf8',
    env: childEnv,
  });
}

describe('with-cpu-budget', () => {
  it('hands pnpm the workspace concurrency from .npmrc when nothing else is running', () => {
    const result = runWrapper(['node', 'probe.mjs'], { BFC_CPU_BUDGET: '8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('2');
  });

  it('lowers it while other runs hold a share of the budget', () => {
    holdLeases(8);
    const result = runWrapper(['node', 'probe.mjs'], { BFC_CPU_BUDGET: '8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('1');
  });

  it('passes the child’s exit code through, so a failing build still fails', () => {
    writeFileSync(path.join(workDir, 'boom.mjs'), 'process.exit(7);\n', 'utf8');
    expect(runWrapper(['node', 'boom.mjs']).status).toBe(7);
  });

  /**
   * `shell: true` with a separate args array concatenates them unescaped — Node's DEP0190. It
   * printed a deprecation warning on every `pnpm build` and really did corrupt arguments
   * (`node -e "console.log(1)"` reached the child as `bad option: -,`).
   */
  it('runs the child without Node’s shell-arguments deprecation warning', () => {
    const result = runWrapper(['node', 'probe.mjs'], { BFC_CPU_BUDGET: '8' });
    expect(result.stderr).not.toContain('DEP0190');
  });

  it('refuses an argument it cannot pass through a shell intact, rather than mangling it', () => {
    const result = runWrapper(['node', '-e', 'console.log(1)']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('refusing to shell-quote');
  });

  it('refuses to run with no command at all', () => {
    const result = runWrapper([]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('usage:');
  });
});
