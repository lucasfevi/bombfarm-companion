import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { LogPort } from '../../storage/index.js';
import { createTrackingEngine, EngineOpenError, type DuckBinding, type LockedDb } from './engine.js';

const KEY = 'a1'.repeat(32);
const FETCH_SCRIPT = resolve(__dirname, '../../../../scripts/fetch-duckdb-extension.mjs');

let scratch = '';
let extension: string | null = null;
let skipReason = '';

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'bfc-engine-'));
  try {
    const fetcher = (await import(/* @vite-ignore */ FETCH_SCRIPT)) as {
      fetchDuckdbExtension: () => Promise<string>;
    };
    extension = await fetcher.fetchDuckdbExtension();
  } catch (error) {
    skipReason = `the signed extension could not be fetched: ${error instanceof Error ? error.message : String(error)}`;
  }
}, 120_000);

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

function recordingLog() {
  const records: Record<string, unknown>[] = [];
  const log: LogPort = {
    info: (record) => {
      records.push(record);
    },
    warn: (record) => {
      records.push(record);
    },
    error: (record) => {
      records.push(record);
    },
  };
  return { log, records };
}

function folder(name: string): string {
  const dir = join(scratch, `${name}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function realEngine(extensionPath: string | null = extension) {
  const { log, records } = recordingLog();
  return { engine: createTrackingEngine({ extensionPath: extensionPath ?? '', log }), records };
}

function tamperedCopy(): string {
  const target = join(folder('tamper'), 'httpfs.duckdb_extension');
  copyFileSync(extension as string, target);
  const bytes = readFileSync(target);
  const at = Math.floor(bytes.length / 2);
  bytes[at] = (bytes[at] as number) ^ 0xff;
  writeFileSync(target, bytes);
  return target;
}

/** A binding whose instances script their answers and count their closes. */
function fakeBinding(options: { answer?: number; failOn?: RegExp; failCreate?: boolean }) {
  const state = { created: 0, closed: 0, sql: [] as string[] };
  const settings: Record<string, string> = {
    enable_external_access: 'false',
    lock_configuration: 'true',
    autoload_known_extensions: 'false',
    allow_unsigned_extensions: 'false',
  };
  const binding: DuckBinding = {
    DuckDBInstance: {
      create: () => {
        if (options.failCreate) return Promise.reject(new Error('create failed'));
        state.created += 1;
        return Promise.resolve({
          connect: () =>
            Promise.resolve({
              run: (sql: string) => {
                state.sql.push(sql);
                return options.failOn?.test(sql) ? Promise.reject(new Error('scripted failure')) : Promise.resolve();
              },
              runAndReadAll: (sql: string) => {
                state.sql.push(sql);
                const setting = /current_setting\('(\w+)'\)/.exec(sql)?.[1];
                const row = setting === undefined ? { v: 'v1.5.5', answer: options.answer ?? 42 } : { v: settings[setting] };
                return Promise.resolve({ getRowObjectsJS: () => [row] });
              },
              closeSync: () => undefined,
            }),
          closeSync: () => {
            state.closed += 1;
          },
        });
      },
    },
  };
  return { binding, state };
}

describe('the engine probe', () => {
  it('answers a value, never a throw, when the binding cannot be required', async () => {
    const { log, records } = recordingLog();
    const engine = createTrackingEngine({
      extensionPath: 'x',
      log,
      loadBinding: () => {
        throw new Error('Cannot find the binding module');
      },
    });
    await expect(engine.probe()).resolves.toEqual({ ok: false, reason: 'binding_missing' });
    expect(records).toEqual([{ scope: 'premium', event: 'premium.tracking_probe', outcome: 'binding_missing' }]);
  });

  it('answers probe_failed when the answer is not 42, and when the instance cannot start', async () => {
    const wrong = fakeBinding({ answer: 41 });
    const a = createTrackingEngine({ extensionPath: 'x', log: recordingLog().log, loadBinding: () => wrong.binding });
    await expect(a.probe()).resolves.toEqual({ ok: false, reason: 'probe_failed' });
    expect(wrong.state.closed).toBe(1);

    const broken = fakeBinding({ failCreate: true });
    const b = createTrackingEngine({ extensionPath: 'x', log: recordingLog().log, loadBinding: () => broken.binding });
    await expect(b.probe()).resolves.toEqual({ ok: false, reason: 'probe_failed' });
  });

  it('answers extension_missing when the extension will not load, and closes the instance', async () => {
    const fake = fakeBinding({ failOn: /^LOAD/ });
    const engine = createTrackingEngine({ extensionPath: 'x', log: recordingLog().log, loadBinding: () => fake.binding });
    await expect(engine.probe()).resolves.toEqual({ ok: false, reason: 'extension_missing' });
    expect(fake.state.closed).toBe(1);
  });

  it('runs once and logs once, however often it is asked', async () => {
    const { log, records } = recordingLog();
    const fake = fakeBinding({});
    const engine = createTrackingEngine({ extensionPath: 'x', log, loadBinding: () => fake.binding });
    const [first, second] = await Promise.all([engine.probe(), engine.probe()]);
    await engine.probe();
    expect(first).toEqual({ ok: true, version: 'v1.5.5' });
    expect(second).toBe(first);
    expect(fake.state.created).toBe(1);
    expect(records).toEqual([{ scope: 'premium', event: 'premium.tracking_probe', outcome: 'ok', version: 'v1.5.5' }]);
  });

  it('loads nothing until it is asked', () => {
    let loads = 0;
    createTrackingEngine({
      extensionPath: 'x',
      log: recordingLog().log,
      loadBinding: () => {
        loads += 1;
        throw new Error('no');
      },
    });
    expect(loads).toBe(0);
  });
});

describe('the engine against the real binding and the signed extension', () => {
  const real = (name: string, body: () => Promise<void>) => {
    it(name, async (context) => {
      if (extension === null) {
        context.skip(skipReason);
      }
      await body();
    });
  };

  real('probes ok with the DuckDB version and logs once', async () => {
    const { engine, records } = realEngine();
    const result = await engine.probe();
    expect(result.ok).toBe(true);
    expect(result.ok ? result.version : '').toMatch(/^v\d+\.\d+\.\d+/);
    await engine.probe();
    expect(records.filter((r) => r['event'] === 'premium.tracking_probe')).toHaveLength(1);
  });

  real('answers extension_missing for a missing file', async () => {
    const { engine } = realEngine(join(folder('none'), 'httpfs.duckdb_extension'));
    await expect(engine.probe()).resolves.toEqual({ ok: false, reason: 'extension_missing' });
  });

  real('answers extension_missing for a file with one byte changed', async () => {
    const { engine } = realEngine(tamperedCopy());
    await expect(engine.probe()).resolves.toEqual({ ok: false, reason: 'extension_missing' });
  });

  real('refuses to open with a tampered extension and creates no database file', async () => {
    const file = join(folder('tamper-open'), 'track.duckdb');
    const { engine } = realEngine(tamperedCopy());
    await expect(engine.open(file, KEY)).rejects.toMatchObject({ name: 'EngineOpenError', reason: 'extension_failed' });
    expect(existsSync(file)).toBe(false);
  });

  real('opens locked: the four settings read back false, true, false, false', async () => {
    const db = await realEngine().engine.open(join(folder('open'), 'track.duckdb'), KEY);
    try {
      const read = async (name: string) => (await db.query(`SELECT current_setting('${name}') AS v`))[0]?.['v'];
      expect([
        await read('enable_external_access'),
        await read('lock_configuration'),
        await read('autoload_known_extensions'),
        await read('allow_unsigned_extensions'),
      ]).toEqual([false, true, false, false]);
    } finally {
      db.close();
    }
  });

  real('writes and reads after the lock, keeps the data encrypted, and reopens with the same key', async () => {
    const file = join(folder('roundtrip'), 'track.duckdb');
    const engine = realEngine().engine;
    const db = await engine.open(file, KEY);
    await db.run('CREATE TABLE t (id INTEGER, label VARCHAR)');
    await db.run('INSERT INTO t VALUES ($1, $2)', [1, 'plaintext-needle-5521']);
    db.close();
    db.close();
    expect(readFileSync(file).toString('latin1')).not.toContain('plaintext-needle-5521');

    const again = await engine.open(file, KEY);
    try {
      expect(await again.query('SELECT id::INTEGER AS id, label FROM t')).toEqual([{ id: 1, label: 'plaintext-needle-5521' }]);
    } finally {
      again.close();
    }
  });

  real('throws EngineOpenError for a wrong key and keeps the file', async () => {
    const file = join(folder('wrongkey'), 'track.duckdb');
    const engine = realEngine().engine;
    (await engine.open(file, KEY)).close();
    const before = readFileSync(file);
    await expect(engine.open(file, 'b2'.repeat(32))).rejects.toMatchObject({ reason: 'attach_failed' });
    expect(readFileSync(file).equals(before)).toBe(true);
  });

  real('rejects a key that is not 64 lowercase hex before touching anything', async () => {
    const file = join(folder('badkey'), 'track.duckdb');
    await expect(realEngine().engine.open(file, "x' ); DROP")).rejects.toBeInstanceOf(EngineOpenError);
    expect(existsSync(file)).toBe(false);
  });

  describe('after open, everything that reaches outside the database is refused', () => {
    let dir = '';
    let marker = '';
    let db: LockedDb | undefined;
    let before = { mtimeMs: 0, body: '' };

    beforeAll(async () => {
      if (extension === null) return;
      dir = folder('locked');
      marker = join(dir, 'marker.csv');
      writeFileSync(marker, 'a,b\n1,SECRET_MARKER\n');
      before = { mtimeMs: statSync(marker).mtimeMs, body: readFileSync(marker, 'utf8') };
      db = await realEngine().engine.open(join(dir, 'track.duckdb'), KEY);
      await db.run('CREATE TABLE drops (id INTEGER, item VARCHAR)');
    });
    afterAll(() => db?.close());

    const fwd = (path: string) => path.split('\\').join('/');
    const refused: Array<[string, () => string]> = [
      ['read_csv', () => `SELECT * FROM read_csv('${fwd(marker)}')`],
      ['read_text', () => `SELECT * FROM read_text('${fwd(marker)}')`],
      ['read_blob', () => `SELECT * FROM read_blob('${fwd(marker)}')`],
      ['glob', () => `SELECT * FROM glob('${fwd(dir)}/*')`],
      ['a file named as a table', () => `SELECT * FROM '${fwd(marker)}'`],
      ['read_csv over https', () => "SELECT * FROM read_csv('https://example.com/x.csv')"],
      ['COPY TO', () => `COPY drops TO '${fwd(join(dir, 'leak.csv'))}'`],
      ['ATTACH of another file', () => `ATTACH '${fwd(join(dir, 'other.duckdb'))}' AS o`],
      ['EXPORT DATABASE', () => `EXPORT DATABASE '${fwd(join(dir, 'exp'))}'`],
      ['INSTALL httpfs', () => 'INSTALL httpfs'],
      ['re-enabling external access', () => 'SET enable_external_access = true'],
      ['unlocking', () => 'SET lock_configuration = false'],
      ['RESET of external access', () => 'RESET enable_external_access'],
      ['a temp directory', () => `SET temp_directory = '${fwd(dir)}'`],
      ['force_mbedtls_unsafe', () => "SET force_mbedtls_unsafe = 'true'"],
    ];

    for (const [label, sql] of refused) {
      it(`refuses ${label}`, async (context) => {
        if (db === undefined) context.skip(skipReason);
        await expect(db?.run(sql())).rejects.toThrow();
      });
    }

    it('left the marker file untouched and created nothing beside the database', (context) => {
      if (db === undefined) context.skip(skipReason);
      expect(statSync(marker).mtimeMs).toBe(before.mtimeMs);
      expect(readFileSync(marker, 'utf8')).toBe(before.body);
      const others = readdirSync(dir).filter((name) => !name.startsWith('track.duckdb'));
      expect(others).toEqual(['marker.csv']);
    });
  });
});

describe('a failed open', () => {
  it.each([
    ['the extension', /^LOAD/, 'extension_failed'],
    ['the attach', /^ATTACH/, 'attach_failed'],
    ['the lock', /^SET lock_configuration/, 'lock_failed'],
  ])('closes the instance and throws when %s fails', async (_label, failOn, reason) => {
    const fake = fakeBinding({ failOn });
    const engine = createTrackingEngine({ extensionPath: 'x', log: recordingLog().log, loadBinding: () => fake.binding });
    await expect(engine.open('db', KEY)).rejects.toMatchObject({ name: 'EngineOpenError', reason });
    expect(fake.state.closed).toBe(1);
  });

  it('closes the instance and throws when a setting does not read back as locked', async () => {
    const fake = fakeBinding({});
    const lying: DuckBinding = {
      DuckDBInstance: {
        create: async (path, options) => {
          const instance = await fake.binding.DuckDBInstance.create(path, options);
          return {
            closeSync: () => {
              instance.closeSync();
            },
            connect: async () => {
              const c = await instance.connect();
              return {
                run: (sql, values) => c.run(sql, values),
                closeSync: () => {
                  c.closeSync();
                },
                runAndReadAll: (sql, values) =>
                  sql.includes("'lock_configuration'")
                    ? Promise.resolve({ getRowObjectsJS: () => [{ v: false }] })
                    : c.runAndReadAll(sql, values),
              };
            },
          };
        },
      },
    };
    const engine = createTrackingEngine({ extensionPath: 'x', log: recordingLog().log, loadBinding: () => lying });
    await expect(engine.open('db', KEY)).rejects.toMatchObject({ reason: 'settings_unexpected' });
    expect(fake.state.closed).toBe(1);
  });

  it('applies the steps in the specified order', async () => {
    const fake = fakeBinding({});
    const engine = createTrackingEngine({ extensionPath: 'ext', log: recordingLog().log, loadBinding: () => fake.binding });
    (await engine.open('db', KEY)).close();
    expect(fake.state.sql).toEqual([
      "LOAD 'ext'",
      `ATTACH 'db' AS track (ENCRYPTION_KEY '${KEY}')`,
      'USE track',
      'SET enable_external_access = false',
      'SET lock_configuration = true',
      "SELECT current_setting('enable_external_access') AS v",
      "SELECT current_setting('lock_configuration') AS v",
      "SELECT current_setting('autoload_known_extensions') AS v",
      "SELECT current_setting('allow_unsigned_extensions') AS v",
    ]);
  });
});
