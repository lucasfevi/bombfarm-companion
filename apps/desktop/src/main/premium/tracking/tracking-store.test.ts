import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { LogPort } from '../../storage/index.js';
import type { SqliteBinding, SqliteDb } from '../../storage/index.js';
import { detectAvailableBindings, openTestAccountDb, warnForUnavailableBindings } from '../../storage/test-support.js';
import { createBundleCache } from '../host/bundle-cache.js';
import { createMetaDb, HOST_NOW } from '../host/host-test-support.js';
import { createSealedRows } from '../licence/licence-store.js';
import type { SecretBox } from '../token-vault.js';
import { currentPlatformExtension } from './test-extension.js';
import {
  createTrackingEngine,
  EngineOpenError,
  type EngineOpenReason,
  type EngineProbe,
  type LockedDb,
  type TrackingEngine,
} from './engine.js';
import {
  createTrackingStore,
  subjectHash,
  TRACKING_DIR,
  trackingKeyRow,
  TrackingUnavailableError,
  type TrackingFs,
} from './tracking-store.js';

const availableBindings = detectAvailableBindings();
warnForUnavailableBindings(availableBindings);

const ALICE = 'user-alice-0001';
const BOB = 'user-bob-0002';
let scratch = '';
let extension = '';

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'bfc-trackstore-'));
  extension = await currentPlatformExtension();
}, 120_000);

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

function folder(name: string): string {
  const dir = join(scratch, `${name}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function fakeBox(overrides: Partial<SecretBox> = {}): SecretBox {
  return {
    isAvailable: () => true,
    encrypt: (plain) => Buffer.from(plain, 'utf8').reverse(),
    decrypt: (cipher) => Buffer.from(cipher).reverse().toString('utf8'),
    ...overrides,
  };
}

function openDb(binding: SqliteBinding): SqliteDb {
  const { db } = openTestAccountDb(binding);
  if (db === null) throw new Error('the test database did not open');
  return db;
}

function rowValue(db: SqliteDb, key: string): string | undefined {
  const row = db.prepare('SELECT value FROM account_meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}
function deferred(): Deferred {
  let resolveIt: () => void = () => undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolveIt = resolvePromise;
  });
  return { promise, resolve: resolveIt };
}

const tick = (): Promise<void> => new Promise((resolveTick) => setImmediate(resolveTick));

/** An engine whose opens create the file (as `ATTACH` does) and are scripted and counted. */
function fakeEngine(options: { probe?: EngineProbe; failOpen?: EngineOpenReason } = {}) {
  const state = {
    opens: [] as { file: string; key: string }[],
    closed: 0,
    live: 0,
    maxLive: 0,
    order: [] as string[],
    gate: null as Deferred | null,
  };
  const engine: TrackingEngine = {
    probe: () => Promise.resolve(options.probe ?? { ok: true, version: 'v-test' }),
    open: (file, key) => {
      state.opens.push({ file, key });
      if (options.failOpen !== undefined) return Promise.reject(new EngineOpenError(options.failOpen));
      if (!existsSync(file)) writeFileSync(file, 'created-by-attach');
      const raw: LockedDb = {
        run: async (sql) => {
          state.live += 1;
          state.maxLive = Math.max(state.maxLive, state.live);
          state.order.push(`start ${sql}`);
          if (sql === 'boom') {
            state.live -= 1;
            throw new Error('statement failed');
          }
          if (state.gate !== null) await state.gate.promise;
          await tick();
          state.order.push(`end ${sql}`);
          state.live -= 1;
        },
        query: () => Promise.resolve([]),
        session: () => Promise.reject(new Error('the fake engine has no sessions')),
        close: () => {
          state.closed += 1;
        },
      };
      return Promise.resolve(raw);
    },
  };
  return { engine, state };
}

function failingFs(failOn: (path: string) => boolean, gate?: Deferred): TrackingFs & { removed: string[] } {
  const removed: string[] = [];
  return {
    removed,
    removeFile: async (path) => {
      if (gate !== undefined) await gate.promise;
      if (failOn(path)) throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' });
      rmSync(path);
      removed.push(path);
    },
  };
}

async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof TrackingUnavailableError) return error.reason;
    throw error;
  }
  return 'resolved';
}

describe('the folder and the hash are pinned', () => {
  it('names the folder and derives the file name from the subject', () => {
    expect(TRACKING_DIR).toBe('premium-tracking');
    expect(subjectHash(ALICE)).toBe('fdf12f8585dc41a65895cfc7af52919f');
    expect(subjectHash(ALICE)).toMatch(/^[0-9a-f]{32}$/);
    expect(subjectHash(BOB)).not.toBe(subjectHash(ALICE));
    expect(trackingKeyRow(ALICE)).toBe(`premium_trackdb_key_v1:${ALICE}`);
  });

  it('is never touched by any bundle-cache sweep, removal or prune', async () => {
    const root = folder('sweep');
    const dir = join(root, TRACKING_DIR);
    mkdirSync(dir, { recursive: true });
    const names = [`${subjectHash(ALICE)}.duckdb`, `${subjectHash(ALICE)}.duckdb.wal`];
    for (const name of names) writeFileSync(join(dir, name), 'history');
    mkdirSync(join(root, 'premium', '3'), { recursive: true });
    mkdirSync(join(root, 'premium', '.incoming-4'), { recursive: true });
    mkdirSync(join(root, 'premium.tombstone-1'), { recursive: true });

    const cache = createBundleCache({ root, db: createMetaDb(), now: () => HOST_NOW });
    await cache.sweepTombstones();
    await cache.prune(9);
    await cache.discard(3);
    await cache.drop();
    expect((await cache.remove()).done).toBe(true);

    expect(readdirSync(dir).sort()).toEqual([...names].sort());
    expect(readFileSync(join(dir, names[0] as string), 'utf8')).toBe('history');
    expect(existsSync(join(root, 'premium'))).toBe(false);
  });
});

describe.each(availableBindings)('the tracking store over the real account_meta table (%s)', (binding) => {
  function setup(options: { box?: Partial<SecretBox>; engine?: ReturnType<typeof fakeEngine>; fs?: TrackingFs } = {}) {
    const root = folder('store');
    const db = openDb(binding);
    const engine = options.engine ?? fakeEngine();
    const rows = createSealedRows(db, fakeBox(options.box));
    const store = createTrackingStore({
      root,
      rows,
      engine: engine.engine,
      ...(options.fs ? { fs: options.fs } : {}),
      closeWaitMs: 50,
    });
    const fileOf = (subject: string): string => join(root, TRACKING_DIR, `${subjectHash(subject)}.duckdb`);
    return { root, db, engine, rows, store, fileOf };
  }

  describe('the open rules', () => {
    it('file absent, key absent: a new 64-hex key is stored, then the engine creates the file', async () => {
      const { db, engine, store, fileOf } = setup();
      await store.db(ALICE);

      const opened = engine.state.opens;
      expect(opened).toHaveLength(1);
      expect(opened[0]?.file).toBe(fileOf(ALICE));
      expect(opened[0]?.key).toMatch(/^[0-9a-f]{64}$/);
      expect(rowValue(db, trackingKeyRow(ALICE))).toBeDefined();
      expect(existsSync(fileOf(ALICE))).toBe(true);
    });

    it('file absent, key present: opens a new file with the key already stored', async () => {
      const { db, engine, rows, store, fileOf } = setup();
      const key = 'ab'.repeat(32);
      rows.write(trackingKeyRow(ALICE), () => JSON.stringify({ key }));
      const before = rowValue(db, trackingKeyRow(ALICE));

      await store.db(ALICE);

      expect(engine.state.opens).toEqual([{ file: fileOf(ALICE), key }]);
      expect(rowValue(db, trackingKeyRow(ALICE))).toBe(before);
    });

    it('file present, key present: opens with that key', async () => {
      const { engine, rows, store, fileOf } = setup();
      const key = 'cd'.repeat(32);
      rows.write(trackingKeyRow(ALICE), () => JSON.stringify({ key }));
      mkdirSync(join(fileOf(ALICE), '..'), { recursive: true });
      writeFileSync(fileOf(ALICE), 'existing history');

      await store.db(ALICE);

      expect(engine.state.opens).toEqual([{ file: fileOf(ALICE), key }]);
    });

    it.each(['bad_key', 'attach_failed'] as const)(
      'file present, key present, engine says %s: db_unreadable, nothing deleted or rewritten',
      async (reason) => {
        const { db, rows, store, fileOf } = setup({ engine: fakeEngine({ failOpen: reason }) });
        rows.write(trackingKeyRow(ALICE), () => JSON.stringify({ key: 'ef'.repeat(32) }));
        const keyBefore = rowValue(db, trackingKeyRow(ALICE));
        mkdirSync(join(fileOf(ALICE), '..'), { recursive: true });
        writeFileSync(fileOf(ALICE), 'existing history');

        expect(await refusal(store.db(ALICE))).toBe('db_unreadable');

        expect(readFileSync(fileOf(ALICE), 'utf8')).toBe('existing history');
        expect(rowValue(db, trackingKeyRow(ALICE))).toBe(keyBefore);
      },
    );

    it('file present, key absent: db_unreadable, no key is made, the engine is never asked', async () => {
      const { db, engine, store, fileOf } = setup();
      mkdirSync(join(fileOf(ALICE), '..'), { recursive: true });
      writeFileSync(fileOf(ALICE), 'existing history');

      expect(await refusal(store.db(ALICE))).toBe('db_unreadable');

      expect(rowValue(db, trackingKeyRow(ALICE))).toBeUndefined();
      expect(engine.state.opens).toHaveLength(0);
      expect(readFileSync(fileOf(ALICE), 'utf8')).toBe('existing history');
    });

    it('file present, key unreadable: db_unreadable, no new key, the row stays, file bytes unchanged', async () => {
      let readable = true;
      const { db, engine, rows, store, fileOf } = setup({
        box: {
          decrypt: (cipher) => {
            if (!readable) throw new Error('decrypt failed');
            return Buffer.from(cipher).reverse().toString('utf8');
          },
        },
      });
      rows.write(trackingKeyRow(ALICE), () => JSON.stringify({ key: '12'.repeat(32) }));
      const keyBefore = rowValue(db, trackingKeyRow(ALICE));
      mkdirSync(join(fileOf(ALICE), '..'), { recursive: true });
      const bytes = Buffer.from([1, 2, 3, 4, 5, 250, 251]);
      writeFileSync(fileOf(ALICE), bytes);
      readable = false;

      expect(await refusal(store.db(ALICE))).toBe('db_unreadable');

      expect(rowValue(db, trackingKeyRow(ALICE))).toBe(keyBefore);
      expect(engine.state.opens).toHaveLength(0);
      expect(readFileSync(fileOf(ALICE)).equals(bytes)).toBe(true);
    });

    it('secure storage unavailable: no_secure_storage, nothing is created', async () => {
      const { root, db, engine, store } = setup({ box: { isAvailable: () => false } });

      expect(await refusal(store.db(ALICE))).toBe('no_secure_storage');

      expect(engine.state.opens).toHaveLength(0);
      expect(rowValue(db, trackingKeyRow(ALICE))).toBeUndefined();
      expect(existsSync(join(root, TRACKING_DIR))).toBe(false);
    });

    it('a key that cannot be written: no_secure_storage and no file', async () => {
      const { root, engine, store, db } = setup();
      db.exec('DROP TABLE account_meta');

      expect(await refusal(store.db(ALICE))).toBe('no_secure_storage');

      expect(engine.state.opens).toHaveLength(0);
      expect(existsSync(join(root, TRACKING_DIR))).toBe(false);
    });

    it('no subject: no_subject', async () => {
      const { engine, store } = setup();
      expect(await refusal(store.db(''))).toBe('no_subject');
      expect(engine.state.opens).toHaveLength(0);
    });

    it('engine unavailable: engine_unavailable, no key and no folder', async () => {
      const { root, db, store } = setup({
        engine: fakeEngine({ probe: { ok: false, reason: 'extension_missing' } }),
      });

      expect(await refusal(store.db(ALICE))).toBe('engine_unavailable');

      expect(rowValue(db, trackingKeyRow(ALICE))).toBeUndefined();
      expect(existsSync(join(root, TRACKING_DIR))).toBe(false);
    });

    it('a new file the engine cannot create: engine_unavailable, not an unreadable history', async () => {
      const { store } = setup({ engine: fakeEngine({ failOpen: 'attach_failed' }) });
      expect(await refusal(store.db(ALICE))).toBe('engine_unavailable');
    });
  });

  describe('subjects', () => {
    it('two subjects get two files and two different keys', async () => {
      const { db, engine, store, fileOf } = setup();
      await store.db(ALICE);
      await store.db(BOB);

      const [a, b] = engine.state.opens;
      expect(a?.file).toBe(fileOf(ALICE));
      expect(b?.file).toBe(fileOf(BOB));
      expect(a?.file).not.toBe(b?.file);
      expect(a?.key).not.toBe(b?.key);
      expect(rowValue(db, trackingKeyRow(ALICE))).not.toBe(rowValue(db, trackingKeyRow(BOB)));
    });

    it('opens each subject once, however many calls ask at the same time', async () => {
      const { engine, store } = setup();
      const [first, second] = await Promise.all([store.db(ALICE), store.db(ALICE)]);
      await store.db(ALICE);
      expect(engine.state.opens).toHaveLength(1);
      expect(first).toBe(second);
    });
  });

  describe('serialisation and close', () => {
    it('runs the calls of one handle one after the other, in order', async () => {
      const { engine, store } = setup();
      const handle = await store.db(ALICE);

      await Promise.all([handle.run('a'), handle.run('b'), handle.run('c')]);

      expect(engine.state.maxLive).toBe(1);
      expect(engine.state.order).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
    });

    it('keeps the chain going after a call fails', async () => {
      const { store, engine } = setup();
      const handle = await store.db(ALICE);
      await expect(handle.run('boom')).rejects.toBeDefined();
      await expect(handle.run('after')).resolves.toBeUndefined();
      expect(engine.state.order).toContain('end after');
    });

    it('close waits for the call in flight, then every later call is unavailable', async () => {
      const { engine, store } = setup();
      const handle = await store.db(ALICE);
      const gate = deferred();
      engine.state.gate = gate;
      const inFlight = handle.run('slow');
      await tick();

      let closed = false;
      const closing = store.close().then(() => {
        closed = true;
      });
      await tick();
      expect(closed).toBe(false);
      expect(engine.state.closed).toBe(0);

      gate.resolve();
      await inFlight;
      await closing;

      expect(closed).toBe(true);
      expect(engine.state.closed).toBe(1);
      expect(await refusal(handle.run('late'))).toBe('engine_unavailable');
      expect(await refusal(store.db(ALICE))).toBe('engine_unavailable');
    });

    it('close stops waiting after the limit and still closes the handle', async () => {
      const { engine, store } = setup();
      const handle = await store.db(ALICE);
      engine.state.gate = deferred();
      void handle.run('stuck');
      await tick();

      await store.close();

      expect(engine.state.closed).toBe(1);
    });

    it('the handle the caller holds cannot close the store', async () => {
      const { engine, store } = setup();
      const handle = await store.db(ALICE);
      handle.close();
      expect(engine.state.closed).toBe(0);
      await expect(handle.run('still')).resolves.toBeUndefined();
    });
  });

  describe('clear', () => {
    async function seeded(options: Parameters<typeof setup>[0] = {}) {
      const ctx = setup(options);
      await ctx.store.db(ALICE);
      writeFileSync(`${ctx.fileOf(ALICE)}.wal`, 'wal bytes');
      return ctx;
    }

    it('closes the handle, deletes the file, its WAL and the key, and reports cleared', async () => {
      const { db, engine, store, fileOf } = await seeded();

      expect(await store.clear(ALICE)).toBe('cleared');

      expect(existsSync(fileOf(ALICE))).toBe(false);
      expect(existsSync(`${fileOf(ALICE)}.wal`)).toBe(false);
      expect(rowValue(db, trackingKeyRow(ALICE))).toBeUndefined();
      expect(engine.state.closed).toBe(1);
    });

    it('is idempotent', async () => {
      const { store } = await seeded();
      expect(await store.clear(ALICE)).toBe('cleared');
      expect(await store.clear(ALICE)).toBe('cleared');
    });

    it('touches only the subject it was asked about', async () => {
      const { db, store, fileOf } = await seeded();
      await store.db(BOB);

      await store.clear(ALICE);

      expect(existsSync(fileOf(BOB))).toBe(true);
      expect(rowValue(db, trackingKeyRow(BOB))).toBeDefined();
    });

    it('refuses calls with clearing while it runs, and answers busy to a second clear', async () => {
      const gate = deferred();
      const fs = failingFs(() => false, gate);
      const { store } = await seeded({ fs });
      const handle = await store.db(ALICE);

      const clearing = store.clear(ALICE);
      await tick();

      expect(await refusal(store.db(ALICE))).toBe('clearing');
      expect(await refusal(handle.run('during'))).toBe('clearing');
      expect(await store.clear(ALICE)).toBe('busy');
      expect(await refusal(store.db(BOB))).toBe('resolved');

      gate.resolve();
      expect(await clearing).toBe('cleared');
    });

    it('lets the subject open a fresh, empty history afterwards with a new key', async () => {
      const { engine, store } = await seeded();
      const firstKey = engine.state.opens[0]?.key;
      await store.clear(ALICE);

      await store.db(ALICE);

      expect(engine.state.opens).toHaveLength(2);
      expect(engine.state.opens[1]?.key).not.toBe(firstKey);
    });

    it('works with the engine unavailable', async () => {
      const root = folder('noengine');
      const db = openDb(binding);
      const rows = createSealedRows(db, fakeBox());
      const dir = join(root, TRACKING_DIR);
      mkdirSync(dir, { recursive: true });
      const file = join(dir, `${subjectHash(ALICE)}.duckdb`);
      writeFileSync(file, 'history');
      writeFileSync(`${file}.wal`, 'wal');
      rows.write(trackingKeyRow(ALICE), () => JSON.stringify({ key: '34'.repeat(32) }));
      const store = createTrackingStore({
        root,
        rows,
        engine: fakeEngine({ probe: { ok: false, reason: 'binding_missing' } }).engine,
      });

      expect(await store.clear(ALICE)).toBe('cleared');

      expect(existsSync(file)).toBe(false);
      expect(existsSync(`${file}.wal`)).toBe(false);
      expect(rowValue(db, trackingKeyRow(ALICE))).toBeUndefined();
    });

    it('a delete that fails answers failed and touches nothing else', async () => {
      const fs = failingFs((path) => path.endsWith('.duckdb'));
      const { db, store, fileOf } = await seeded({ fs });

      expect(await store.clear(ALICE)).toBe('failed');

      expect(existsSync(fileOf(ALICE))).toBe(true);
      expect(existsSync(`${fileOf(ALICE)}.wal`)).toBe(true);
      expect(rowValue(db, trackingKeyRow(ALICE))).toBeDefined();
      expect(fs.removed).toEqual([]);
    });

    it('a WAL delete that fails keeps the key, and the next clear finishes the job', async () => {
      let failWal = true;
      const fs = failingFs((path) => failWal && path.endsWith('.wal'));
      const { db, store, fileOf } = await seeded({ fs });

      expect(await store.clear(ALICE)).toBe('failed');
      expect(rowValue(db, trackingKeyRow(ALICE))).toBeDefined();
      expect(existsSync(`${fileOf(ALICE)}.wal`)).toBe(true);

      failWal = false;
      expect(await store.clear(ALICE)).toBe('cleared');
      expect(existsSync(`${fileOf(ALICE)}.wal`)).toBe(false);
      expect(rowValue(db, trackingKeyRow(ALICE))).toBeUndefined();
    });

    it('a key row that cannot be deleted answers failed', async () => {
      const { db, store } = await seeded();
      db.exec('DROP TABLE account_meta');
      // With the table gone the delete is refused by the database.
      expect(await store.clear(ALICE)).toBe('failed');
    });
  });

  describe('status', () => {
    it('is none when there is no file, and present with the file plus WAL sizes otherwise', async () => {
      const { engine, store, fileOf } = setup();
      await engine.engine.probe();
      await tick();
      expect(store.status(ALICE)).toEqual({ state: 'none' });

      mkdirSync(join(fileOf(ALICE), '..'), { recursive: true });
      writeFileSync(fileOf(ALICE), Buffer.alloc(100));
      expect(store.status(ALICE)).toEqual({ state: 'present', bytes: 100 });
      writeFileSync(`${fileOf(ALICE)}.wal`, Buffer.alloc(28));
      expect(store.status(ALICE)).toEqual({ state: 'present', bytes: 128 });
    });

    it('says the engine is unavailable, with the bytes on disk, without opening anything', async () => {
      const unavailable = fakeEngine({ probe: { ok: false, reason: 'probe_failed' } });
      const { store, fileOf } = setup({ engine: unavailable });
      await tick();
      expect(store.status(ALICE)).toEqual({ state: 'engine_unavailable', bytes: null, reason: 'probe_failed' });

      mkdirSync(join(fileOf(ALICE), '..'), { recursive: true });
      writeFileSync(fileOf(ALICE), Buffer.alloc(40));
      expect(store.status(ALICE)).toEqual({ state: 'engine_unavailable', bytes: 40, reason: 'probe_failed' });
      expect(unavailable.state.opens).toHaveLength(0);
    });
  });

  describe('against the real engine and the signed extension', () => {
    const real = (name: string, body: () => Promise<void>) => {
      it(name, body);
    };
    const silent: LogPort = { info: () => undefined, warn: () => undefined, error: () => undefined };

    function realStore(root: string, db: SqliteDb, box: Partial<SecretBox> = {}) {
      return createTrackingStore({
        root,
        rows: createSealedRows(db, fakeBox(box)),
        engine: createTrackingEngine({ extensionPath: extension, log: silent }),
      });
    }

    real('keeps history across a restart, and a second subject cannot read it', async () => {
      const root = folder('real');
      const db = openDb(binding);
      const first = realStore(root, db);
      const alice = await first.db(ALICE);
      await alice.run('CREATE TABLE t (n INTEGER)');
      await alice.run('INSERT INTO t VALUES (?)', [41]);
      await first.close();

      const second = realStore(root, db);
      const again = await second.db(ALICE);
      expect(await again.query('SELECT n FROM t')).toEqual([{ n: 41 }]);
      const bob = await second.db(BOB);
      await expect(bob.query('SELECT n FROM t')).rejects.toBeDefined();
      expect(readdirSync(join(root, TRACKING_DIR)).filter((n) => n.endsWith('.duckdb'))).toHaveLength(2);
      await second.close();

      // Neither file opens with the other's key.
      const engine = createTrackingEngine({ extensionPath: extension, log: silent });
      const keyOf = (subject: string): string => {
        const rows = createSealedRows(db, fakeBox());
        const kept = rows.readKept(trackingKeyRow(subject), ({ key }) => (typeof key === 'string' ? key : null));
        if (!kept.ok) throw new Error('no key');
        return kept.value;
      };
      const aliceFile = join(root, TRACKING_DIR, `${subjectHash(ALICE)}.duckdb`);
      const bobFile = join(root, TRACKING_DIR, `${subjectHash(BOB)}.duckdb`);
      expect(keyOf(ALICE)).not.toBe(keyOf(BOB));
      await expect(engine.open(aliceFile, keyOf(BOB))).rejects.toBeInstanceOf(EngineOpenError);
      await expect(engine.open(bobFile, keyOf(ALICE))).rejects.toBeInstanceOf(EngineOpenError);
    });

    real('an unreadable key leaves the real file byte for byte and makes no new key', async () => {
      const root = folder('real-unreadable');
      const db = openDb(binding);
      const first = realStore(root, db);
      await (await first.db(ALICE)).run('CREATE TABLE t (n INTEGER)');
      await first.close();
      const file = join(root, TRACKING_DIR, `${subjectHash(ALICE)}.duckdb`);
      const before = readFileSync(file);
      const keyBefore = rowValue(db, trackingKeyRow(ALICE));

      const broken = realStore(root, db, {
        decrypt: () => {
          throw new Error('decrypt failed');
        },
      });
      expect(await refusal(broken.db(ALICE))).toBe('db_unreadable');

      expect(readFileSync(file).equals(before)).toBe(true);
      expect(rowValue(db, trackingKeyRow(ALICE))).toBe(keyBefore);
    });

    real('clear removes the real file and its key, and status follows', async () => {
      const root = folder('real-clear');
      const db = openDb(binding);
      const store = realStore(root, db);
      await (await store.db(ALICE)).run('CREATE TABLE t (n INTEGER)');
      await tick();
      expect(store.status(ALICE).state).toBe('present');

      expect(await store.clear(ALICE)).toBe('cleared');

      expect(store.status(ALICE)).toEqual({ state: 'none' });
      expect(rowValue(db, trackingKeyRow(ALICE))).toBeUndefined();
      expect(readdirSync(join(root, TRACKING_DIR))).toEqual([]);
    });
  });
});

describe('only clear deletes under the tracking folder', () => {
  const source = readFileSync(resolve(__dirname, 'tracking-store.ts'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('names a delete primitive in the import and the one default only', () => {
    const lines = code.split('\n').filter((line) => /\b(unlink|unlinkSync|rm|rmSync|rmdir|rmdirSync|truncate|rename)\b/.test(line));
    expect(lines).toEqual([
      "import { unlink } from 'node:fs/promises';",
      'const nodeFs: TrackingFs = { removeFile: (path) => unlink(path) };',
    ]);
  });

  it('calls the injected delete only inside clear', () => {
    const start = code.indexOf('async function clear(');
    expect(start).toBeGreaterThan(0);
    const end = code.indexOf('\n  }\n', start);
    const body = code.slice(start, end);
    const calls = [...code.matchAll(/\.removeFile\(/g)].length;
    expect(calls).toBe(1);
    expect(body).toContain('fs.removeFile(');
  });

  it('writes nothing to the tracking files itself', () => {
    expect(code).not.toMatch(/\b(writeFile|writeFileSync|appendFile|copyFile|createWriteStream)\b/);
  });
});
