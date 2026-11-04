import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { buildSync } from 'esbuild';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { currentPlatformExtension } from './test-extension.js';

/**
 * The logger's control functions, aimed at a folder the lock forbids, leave a connection that fails
 * every statement and aborts the process when closed. The gate and the engine refuse those
 * functions, so this reaches the state the only way left: a binding that rewrites a marker
 * statement into the call, in a child process, so a crash is an exit code and not a dead test run.
 */

let scratch = '';
let extension = '';
let bundle = '';
const DESKTOP = resolve(__dirname, '../../../..');

beforeAll(async () => {
  extension = await currentPlatformExtension();
  scratch = mkdtempSync(join(tmpdir(), 'bfc-poison-'));
  const driver = join(scratch, 'driver.ts');
  writeFileSync(
    driver,
    `
import { createRequire } from 'node:module';
import { createTrackingEngine } from ${JSON.stringify(join(__dirname, 'engine.ts'))};
const real = createRequire(process.env.DESKTOP_ROOT + '/package.json')('@duck' + 'db/node-api');
let nativeCloses = 0;
const rewrite = (sql: string): string =>
  sql === "SELECT 'POISON'"
    ? "SELECT * FROM enable_logging(storage='file', storage_config={'path': '" + process.env.FORBIDDEN + "'})"
    : sql;
const binding = {
  StatementType: real.StatementType,
  DuckDBInstance: {
    create: async (path: string, options: Record<string, string>) => {
      const instance = await real.DuckDBInstance.create(path, options);
      return {
        closeSync: () => { nativeCloses += 1; instance.closeSync(); },
        connect: async () => {
          const c = await instance.connect();
          return {
            run: (sql: string, v?: unknown[]) => c.run(rewrite(sql), v),
            runAndReadAll: (sql: string, v?: unknown[]) => c.runAndReadAll(rewrite(sql), v),
            streamAndReadUntil: (sql: string, n: number, v?: unknown[]) => c.streamAndReadUntil(rewrite(sql), n, v),
            extractStatements: (sql: string) => c.extractStatements(sql),
            interrupt: () => c.interrupt(),
            closeSync: () => { nativeCloses += 1; c.closeSync(); },
          };
        },
      };
    },
  },
};
const noop = () => undefined;
const engine = createTrackingEngine({
  extensionPath: process.env.EXTENSION as string,
  log: { info: noop, warn: noop, error: noop },
  loadBinding: () => binding as never,
});
const db = await engine.open(process.env.DB_FILE as string, 'd4'.repeat(32));
if (process.env.MODE === 'poison') await db.query("SELECT 'POISON'");
try { await db.query('SELECT 1 AS one'); console.log('still works'); } catch { console.log('poisoned'); }
db.close();
console.log('closed nativeCloses=' + nativeCloses);
`,
  );
  bundle = join(scratch, 'driver.mjs');
  buildSync({
    entryPoints: [driver],
    outfile: bundle,
    bundle: true,
    platform: 'node',
    format: 'esm',
    external: ['@duck' + 'db/*', 'node:*'],
    logLevel: 'silent',
    absWorkingDir: DESKTOP,
  });
}, 120_000);

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

function runDriver(name: string, mode: 'poison' | 'healthy') {
  const dir = join(scratch, name);
  mkdirSync(dirname(join(dir, 'x')), { recursive: true });
  mkdirSync(join(scratch, `${name}-forbidden`), { recursive: true });
  const forbidden = dir.split(String.fromCharCode(92)).join('/');
  return spawnSync(process.execPath, [bundle], {
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      ...process.env,
      DESKTOP_ROOT: DESKTOP,
      EXTENSION: extension,
      DB_FILE: join(dir, 'track.duckdb'),
      FORBIDDEN: forbidden,
      MODE: mode,
    },
  });
}

describe('a handle the logger has poisoned', () => {
  it('is detected on its first failing statement and never closed natively, so the process lives', () => {
    const child = runDriver('poisoned', 'poison');
    expect(child.stdout).toContain('poisoned');
    expect(child.stdout).toContain('closed nativeCloses=0');
    expect(child.status).toBe(0);
  }, 90_000);

  it('control: a healthy handle is closed natively, connection and instance', () => {
    const child = runDriver('healthy', 'healthy');
    expect(child.stdout).toContain('still works');
    expect(child.stdout).toContain('closed nativeCloses=2');
    expect(child.status).toBe(0);
  }, 90_000);
});
