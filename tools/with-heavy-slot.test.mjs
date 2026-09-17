import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const WRAPPER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'with-heavy-slot.mjs');

/** Printed by the probe, so the test reads what the wrapped command would have inherited. */
const PROBE = "process.stdout.write(String(process.env.BFC_HEAVY_SLOT ?? 'none'));\n";

let workDir;
let leaseDir;

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'bfc-heavy-slot-test-'));
  leaseDir = path.join(workDir, 'leases');
  writeFileSync(path.join(workDir, 'probe.mjs'), PROBE, 'utf8');
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function slotFile() {
  return path.join(leaseDir, 'heavy-run.lock');
}

function childEnv() {
  const env = { ...process.env, BFC_CPU_LEASE_DIR: leaseDir };
  // Vitest holds a lease and may hold the slot; the wrapper has to look like a fresh run.
  delete env.BFC_CPU_LEASE;
  delete env.BFC_HEAVY_SLOT;
  delete env.CI;
  return env;
}

function runWrapper(args) {
  return spawnSync(process.execPath, [WRAPPER, ...args], { cwd: workDir, encoding: 'utf8', env: childEnv() });
}

describe('with-heavy-slot', () => {
  it('takes the slot, hands it to the command, and gives it back on exit', () => {
    const result = runWrapper(['node', 'probe.mjs']);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toBe('none');
    expect(existsSync(slotFile())).toBe(false);
  });

  it('waits for a live holder and runs once that holder is gone', async () => {
    writeFileSync(path.join(workDir, 'hold.mjs'), 'setTimeout(() => {}, 60_000);\n', 'utf8');
    const holder = spawn(process.execPath, ['hold.mjs'], { cwd: workDir, stdio: 'ignore' });
    await new Promise((resolve) => holder.once('spawn', resolve));
    try {
      mkdirSync(leaseDir, { recursive: true });
      writeFileSync(slotFile(), JSON.stringify({ pid: holder.pid, kind: 'vitest run', startedAt: Date.now() }), 'utf8');

      const waiter = spawn(process.execPath, [WRAPPER, 'node', 'probe.mjs'], { cwd: workDir, env: childEnv() });
      let stderr = '';
      let stdout = '';
      waiter.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      waiter.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      expect(stdout).toBe('');
      expect(stderr).toContain('waiting for the heavy-run slot');
      expect(stderr).toContain('vitest run');

      holder.kill();
      const exitCode = await new Promise((resolve) => waiter.once('exit', resolve));
      expect(exitCode).toBe(0);
      expect(stdout).not.toBe('none');
      expect(existsSync(slotFile())).toBe(false);
    } finally {
      holder.kill();
    }
  }, 20_000);

  it('passes the child’s exit code through, so a failing suite still fails', () => {
    writeFileSync(path.join(workDir, 'boom.mjs'), 'process.exit(7);\n', 'utf8');
    expect(runWrapper(['node', 'boom.mjs']).status).toBe(7);
  });

  it('refuses an argument it cannot pass through a shell intact, rather than mangling it', () => {
    const result = runWrapper(['node', '-e', 'console.log(1)']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('refusing to shell-quote');
  });
});
