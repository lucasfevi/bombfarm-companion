import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TRACKING_DB_LIMITS, type DbArgs, type DbRefusalReason } from '@bombfarm/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { LogPort } from '../../../storage/index.js';
import type { KeepingSealedRows } from '../../licence/licence-store.js';
import { createTrackingEngine, EngineStatementError, type DbSession, type StatementErrorKind } from '../../tracking/engine.js';
import { currentPlatformExtension } from '../../tracking/test-extension.js';
import { createTrackingStore, TrackingUnavailableError, type TrackingStore } from '../../tracking/tracking-store.js';
import { CapabilityError, type CallOrigin, type CapabilityHandler } from '../capability-channel.js';
import { createDbCapability } from './db.js';

const ALICE = 'user-alice-0001';
let scratch = '';
let extension = '';
let counter = 0;

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'bfc-dbcap-'));
  extension = await currentPlatformExtension();
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

/** Sealed rows in memory: the key row is all the store keeps there. */
function memoryRows(over: { available?: boolean } = {}): KeepingSealedRows & { map: Map<string, string> } {
  const map = new Map<string, string>();
  const available = over.available ?? true;
  return {
    map,
    available: () => available,
    read: <T>(key: string, parse: (v: Record<string, unknown>) => T | null) => {
      const raw = map.get(key);
      return raw === undefined ? null : parse(JSON.parse(raw) as Record<string, unknown>);
    },
    readKept: <T>(key: string, parse: (v: Record<string, unknown>) => T | null) => {
      if (!available) return { ok: false, reason: 'unavailable' } as const;
      const raw = map.get(key);
      if (raw === undefined) return { ok: false, reason: 'absent' } as const;
      const value = parse(JSON.parse(raw) as Record<string, unknown>);
      return value === null ? ({ ok: false, reason: 'unreadable' } as const) : ({ ok: true, value } as const);
    },
    write: (key, json) => {
      if (!available) return 'unavailable';
      map.set(key, json());
      return 'written';
    },
    delete: (key) => map.delete(key) || true,
  };
}

function realRig(over: { statementMs?: number; subject?: string | null; rows?: KeepingSealedRows } = {}) {
  const root = join(scratch, `rig-${String((counter += 1))}`);
  mkdirSync(root, { recursive: true });
  const { log, records } = recordingLog();
  const engine = createTrackingEngine({ extensionPath: extension, log });
  const rows = over.rows ?? memoryRows();
  const store = createTrackingStore({ root, rows, engine, closeWaitMs: 50 });
  let clock = 0;
  const handler = createDbCapability({
    subject: () => (over.subject === undefined ? ALICE : over.subject),
    store,
    mono: () => (clock += 3),
    log,
    ...(over.statementMs === undefined ? {} : { statementMs: over.statementMs }),
  });
  return { root, store, records, rows, handler };
}

async function outcome(handler: CapabilityHandler, args: unknown, origin: CallOrigin = 'worker') {
  try {
    const value = await (handler as (a: unknown, c: { origin: CallOrigin }) => unknown)(args, { origin });
    return { ok: true as const, value: value as never };
  } catch (error) {
    if (error instanceof CapabilityError) return { ok: false as const, code: error.code, reason: error.reason };
    throw error;
  }
}

function refusedWith(code: string, reason?: DbRefusalReason) {
  return { ok: false, code, reason };
}

describe('the db capability over a real, sealed DuckDB file', () => {
  let rig: ReturnType<typeof realRig>;
  const call = (args: DbArgs | Record<string, unknown>, origin: CallOrigin = 'worker') =>
    outcome(rig.handler, args, origin);
  const count = async (table: string): Promise<number> => {
    const answer = await call({ op: 'query', sql: `SELECT count(*) AS n FROM ${table}` });
    return Number((answer as { value: { rows: unknown[][] } }).value.rows[0]?.[0]);
  };

  beforeAll(async () => {
    rig = realRig();
    const made = await call({
      op: 'exec',
      sql: 'CREATE TABLE drops (id INTEGER PRIMARY KEY, item VARCHAR, big BIGINT, price DECIMAL(10,2), seen TIMESTAMP, flag BOOLEAN, score DOUBLE)',
    });
    expect(made).toEqual({ ok: true, value: { changes: 0 } });
  });
  afterAll(async () => {
    await rig.store.close();
  });

  describe('each op answers its shape', () => {
    it('exec answers the rows it changed', async () => {
      expect(await call({ op: 'exec', sql: 'INSERT INTO drops (id, item) VALUES ($1, $2), ($3, $4)', params: [1, 'a', 2, 'b'] })).toEqual({
        ok: true,
        value: { changes: 2 },
      });
      expect(await call({ op: 'exec', sql: 'UPDATE drops SET item = $1 WHERE id = $2', params: ['z', 2] })).toEqual({
        ok: true,
        value: { changes: 1 },
      });
    });

    it('query answers columns and rows, with BIGINT, DECIMAL and dates as strings', async () => {
      await call({
        op: 'exec',
        sql: "INSERT INTO drops VALUES (10, 'gem', 9007199254740993, 1.50, TIMESTAMP '2026-01-02 03:04:05', true, 2.5)",
      });
      const answer = await call({ op: 'query', sql: 'SELECT item, big, price, seen, flag, score, NULL AS gone FROM drops WHERE id = $1', params: [10] });
      expect(answer).toEqual({
        ok: true,
        value: {
          columns: ['item', 'big', 'price', 'seen', 'flag', 'score', 'gone'],
          rows: [['gem', '9007199254740993', '1.50', '2026-01-02 03:04:05', true, 2.5, null]],
        },
      });
    });

    it('query answers a list as its JSON text, a scalar type the contract does not name', async () => {
      const answer = await call({ op: 'query', sql: 'SELECT [1, 2] AS l' });
      expect(answer).toEqual({ ok: true, value: { columns: ['l'], rows: [['[1,2]']] } });
    });

    it('batch applies one statement per row and answers the total changed', async () => {
      const answer = await call({
        op: 'batch',
        sql: 'INSERT INTO drops (id, item) VALUES ($1, $2)',
        rows: [
          [100, 'x'],
          [101, 'y'],
          [102, 'w'],
        ],
      });
      expect(answer).toEqual({ ok: true, value: { changes: 3 } });
      expect(await count('drops WHERE id >= 100')).toBe(3);
    });

    it('tx answers one count per step, in order, and a step may use what an earlier step created', async () => {
      const answer = await call({
        op: 'tx',
        steps: [
          { sql: 'CREATE TABLE made_in_tx (n INTEGER)' },
          { sql: 'INSERT INTO made_in_tx VALUES ($1), ($2)', params: [1, 2] },
          { sql: 'DELETE FROM made_in_tx WHERE n = $1', params: [1] },
        ],
      });
      expect(answer).toEqual({ ok: true, value: { changes: [0, 2, 1] } });
      expect(await count('made_in_tx')).toBe(1);
    });

    it('size answers the file plus its WAL, which grows with a write', async () => {
      const before = await call({ op: 'size' });
      expect(before.ok && (before.value as { bytes: number }).bytes).toBeGreaterThan(0);
      await call({ op: 'batch', sql: 'INSERT INTO drops (id, item) VALUES ($1, $2)', rows: Array.from({ length: 300 }, (_, i) => [1000 + i, 'q'.repeat(200)]) });
      const after = await call({ op: 'size' });
      expect((after as { value: { bytes: number } }).value.bytes).toBeGreaterThanOrEqual((before as { value: { bytes: number } }).value.bytes);
    });

    it('status answers ready once the file opens', async () => {
      expect(await call({ op: 'status' })).toEqual({ ok: true, value: { state: 'ready' } });
    });
  });

  describe('the statement gate refuses before anything runs', () => {
    let marker = '';
    let mtime = 0;
    beforeAll(() => {
      marker = join(rig.root, 'marker.csv');
      writeFileSync(marker, 'a,b\n1,MARKER\n');
      mtime = statSync(marker).mtimeMs;
    });
    const fwd = (path: string): string => path.split('\\').join('/');

    it.each([
      ['two statements', 'SELECT 1; SELECT 2', 'statement_count'],
      ['a trailing second statement', 'INSERT INTO drops (id) VALUES (900); DROP TABLE drops', 'statement_count'],
      ['an empty string', '', 'statement_count'],
      ['only a comment', '-- nothing', 'statement_count'],
    ] as const)('refuses %s with statement_count', async (_label, sql, reason) => {
      expect(await call({ op: 'exec', sql })).toEqual(refusedWith('bad_args', reason));
      expect(await count('drops WHERE id = 900')).toBe(0);
    });

    it.each([
      ['BEGIN', 'BEGIN'],
      ['COMMIT', 'COMMIT'],
      ['a PRAGMA', 'PRAGMA enable_progress_bar'],
      ['SET', 'SET threads = 8'],
      ['USE', 'USE memory'],
      ['CHECKPOINT', 'CHECKPOINT'],
      ['INSTALL', 'INSTALL httpfs'],
      ['LOAD', 'LOAD httpfs'],
      ['EXPLAIN', 'EXPLAIN SELECT 1'],
      ['ANALYZE', 'ANALYZE'],
      ['PREPARE', 'PREPARE q AS SELECT 1'],
      ['a variable set', "SET VARIABLE v = 1"],
      ['UPDATE EXTENSIONS', 'UPDATE EXTENSIONS'],
      ['CALL', 'CALL pragma_version()'],
    ])('refuses %s as a statement type', async (_label, sql) => {
      expect(await call({ op: 'exec', sql })).toEqual(refusedWith('bad_args', 'statement_type'));
    });

    it.each([
      ['ATTACH', () => `ATTACH '${fwd(join(rig.root, 'other.duckdb'))}' AS o`],
      ['DETACH', () => 'DETACH track'],
      ['COPY TO', () => `COPY drops TO '${fwd(join(rig.root, 'leak.csv'))}'`],
      ['COPY FROM', () => `COPY drops FROM '${fwd(marker)}'`],
      ['EXPORT DATABASE', () => `EXPORT DATABASE '${fwd(join(rig.root, 'exp'))}'`],
      ['EXECUTE', () => 'EXECUTE q'],
    ])('refuses %s, by type or at bind', async (_label, sql) => {
      const answer = await call({ op: 'exec', sql: sql() });
      expect(answer.ok).toBe(false);
      expect(answer).toMatchObject({ code: 'bad_args' });
      expect(['statement_type', 'bind']).toContain((answer as { reason: string }).reason);
    });

    it.each([
      ['CREATE SECRET', "CREATE SECRET s (TYPE s3, KEY_ID 'k', SECRET 's')"],
      ['CREATE OR REPLACE PERSISTENT SECRET', "CREATE OR REPLACE PERSISTENT SECRET s (TYPE s3, KEY_ID 'k', SECRET 's')"],
      ['CREATE SECRET behind comments', "/* hi */ -- x\n  create temporary secret s (TYPE s3, KEY_ID 'k', SECRET 's')"],
    ])('refuses %s as a statement type', async (_label, sql) => {
      expect(await call({ op: 'exec', sql })).toEqual(refusedWith('bad_args', 'statement_type'));
    });

    it.each([
      ['read_csv', (m: string) => `SELECT * FROM read_csv('${m}')`],
      ['read_parquet', (m: string) => `SELECT * FROM read_parquet('${m}')`],
      ['read_json', (m: string) => `SELECT * FROM read_json('${m}')`],
      ['glob', (m: string) => `SELECT * FROM glob('${m}')`],
    ])('refuses %s by name: statement_type for the worker, not_granted for the screen', async (_label, make) => {
      const sql = make(fwd(marker));
      expect(await call({ op: 'query', sql })).toEqual(refusedWith('bad_args', 'statement_type'));
      expect(await call({ op: 'query', sql }, 'ui')).toEqual(refusedWith('not_granted'));
      expect(await call({ op: 'exec', sql: `INSERT INTO drops (id, item) SELECT 1, a FROM read_csv('${fwd(marker)}')` })).toEqual(
        refusedWith('bad_args', 'statement_type'),
      );
    });

    it('refuses a file named as a table at bind, because the lock refuses the read', async () => {
      const sql = `SELECT * FROM '${fwd(marker)}'`;
      expect(await call({ op: 'query', sql })).toEqual(refusedWith('bad_args', 'bind'));
      expect(await call({ op: 'query', sql }, 'ui')).toEqual(refusedWith('bad_args', 'bind'));
    });

    it('refuses a parameter count that does not match, an unknown table and a syntax error at bind', async () => {
      expect(await call({ op: 'exec', sql: 'INSERT INTO drops (id) VALUES ($1)', params: [1, 2] })).toEqual(refusedWith('bad_args', 'bind'));
      expect(await call({ op: 'exec', sql: 'INSERT INTO drops (id) VALUES ($1)' })).toEqual(refusedWith('bad_args', 'bind'));
      expect(await call({ op: 'query', sql: 'SELECT * FROM nope' })).toEqual(refusedWith('bad_args', 'bind'));
      expect(await call({ op: 'query', sql: 'SELEC 1' })).toEqual(refusedWith('bad_args', 'bind'));
    });

    it('left the marker file untouched and wrote nothing beside the database', () => {
      expect(statSync(marker).mtimeMs).toBe(mtime);
      expect(readFileSync(marker, 'utf8')).toBe('a,b\n1,MARKER\n');
    });
  });

  describe('the allow-lists per op', () => {
    it.each([
      ['SELECT', 'SELECT 1'],
      ['INSERT', 'INSERT INTO drops (id) VALUES (3000)'],
      ['UPDATE', "UPDATE drops SET item = 'u' WHERE id = 3000"],
      ['DELETE', 'DELETE FROM drops WHERE id = 3000'],
      ['MERGE_INTO', "MERGE INTO drops USING (SELECT 3001 AS id) s ON drops.id = s.id WHEN NOT MATCHED THEN INSERT (id) VALUES (s.id)"],
      ['CREATE', 'CREATE TABLE IF NOT EXISTS lists_ok (a INTEGER)'],
      ['ALTER', 'ALTER TABLE lists_ok ADD COLUMN b INTEGER'],
      ['DROP', 'DROP TABLE lists_ok'],
    ])('lets the worker exec a %s', async (_label, sql) => {
      expect((await call({ op: 'exec', sql })).ok).toBe(true);
    });

    it('lets a batch run only INSERT, UPDATE, DELETE and MERGE', async () => {
      for (const sql of ['SELECT $1', 'CREATE TABLE b1 (a INTEGER)', 'DROP TABLE drops']) {
        expect(await call({ op: 'batch', sql, rows: [sql.includes('$1') ? [1] : []] })).toEqual(refusedWith('bad_args', 'statement_type'));
      }
      expect(await count('drops')).toBeGreaterThan(0);
    });

    it('refuses a SELECT step in a tx, rolls the earlier steps back, and wrote nothing', async () => {
      const answer = await call({
        op: 'tx',
        steps: [{ sql: 'INSERT INTO drops (id) VALUES (4000)' }, { sql: 'SELECT 1' }],
      });
      expect(answer).toEqual(refusedWith('bad_args', 'statement_type'));
      expect(await count('drops WHERE id = 4000')).toBe(0);
    });

    it('runs the screen only for query, size and status', async () => {
      const select = await call({ op: 'query', sql: 'SELECT count(*) AS n FROM drops' }, 'ui');
      expect(select.ok).toBe(true);
      expect((await call({ op: 'size' }, 'ui')).ok).toBe(true);
      expect(await call({ op: 'status' }, 'ui')).toEqual({ ok: true, value: { state: 'ready' } });
      expect(await call({ op: 'exec', sql: 'INSERT INTO drops (id) VALUES (5000)' }, 'ui')).toEqual(refusedWith('not_granted'));
      expect(await call({ op: 'batch', sql: 'INSERT INTO drops (id) VALUES ($1)', rows: [[5000]] }, 'ui')).toEqual(refusedWith('not_granted'));
      expect(await call({ op: 'tx', steps: [{ sql: 'INSERT INTO drops (id) VALUES (5000)' }] }, 'ui')).toEqual(refusedWith('not_granted'));
      for (const sql of ['INSERT INTO drops (id) VALUES (5000)', 'CREATE TABLE ui_made (a INTEGER)', 'DELETE FROM drops', 'DROP TABLE drops']) {
        expect(await call({ op: 'query', sql }, 'ui')).toEqual(refusedWith('not_granted'));
      }
      expect(await count('drops WHERE id = 5000')).toBe(0);
      expect(await count('drops')).toBeGreaterThan(0);
    });
  });

  describe('functions that run despite the lock are refused by name', () => {
    const dir = (): string => rig.root.split(String.fromCharCode(92)).join('/');
    const bypasses: Array<[string, () => string]> = [
      ['enable_logging to a folder', () => `SELECT * FROM enable_logging(storage='file', storage_config={'path': '${dir()}'})`],
      ['enable_logging, upper case and quoted', () => `SELECT * FROM "ENABLE_LOGGING" (level='debug')`],
      ['disable_logging', () => 'SELECT * FROM disable_logging()'],
      ['truncate_duckdb_logs', () => 'SELECT * FROM truncate_duckdb_logs()'],
      ['checkpoint()', () => 'SELECT * FROM checkpoint()'],
      ['force_checkpoint()', () => 'SELECT * FROM force_checkpoint()'],
      ['sniff_csv', () => `SELECT * FROM sniff_csv('${dir()}/marker.csv')`],
      ['duckdb_databases()', () => 'SELECT path FROM duckdb_databases()'],
      ['duckdb_databases without parentheses', () => 'SELECT path FROM duckdb_databases'],
      ['duckdb_settings()', () => 'SELECT * FROM duckdb_settings()'],
      ['pragma_database_list', () => 'SELECT * FROM pragma_database_list'],
      ['a schema-qualified read_csv', () => `SELECT * FROM main.read_csv('${dir()}/marker.csv')`],
      ['glob', () => `SELECT * FROM glob('${dir()}/*')`],
      ['query()', () => "SELECT * FROM query('SELECT 1')"],
      ['query_table()', () => "SELECT * FROM query_table('drops')"],
      ['current_setting()', () => "SELECT current_setting('secret_directory')"],
      ['a call hidden after a string and a comment', () => "SELECT 'a''b', /* x */ 1 FROM checkpoint -- y\n ()"],
      ['a call inside a macro body', () => 'CREATE MACRO leak() AS TABLE SELECT * FROM duckdb_databases()'],
    ];

    it.each(bypasses)('refuses %s from the worker and the screen, and the handle survives', async (_label, make) => {
      const sql = make();
      expect(await call({ op: 'query', sql })).toEqual(refusedWith('bad_args', 'statement_type'));
      expect(await call({ op: 'query', sql }, 'ui')).toEqual(refusedWith('not_granted'));
      expect(await call({ op: 'exec', sql })).toEqual(refusedWith('bad_args', 'statement_type'));
      expect(await call({ op: 'tx', steps: [{ sql }] })).toEqual(refusedWith('bad_args', 'statement_type'));
      expect((await call({ op: 'query', sql: 'SELECT 1' })).ok).toBe(true);
    });

    it('does not refuse a name that is only text, an alias or a column', async () => {
      const answer = await call({
        op: 'query',
        sql: "SELECT 'checkpoint()' AS \"read_at\", /* duckdb_databases() */ 1 AS query -- glob()\n",
      });
      expect(answer).toEqual({ ok: true, value: { columns: ['read_at', 'query'], rows: [['checkpoint()', 1]] } });
    });

    it('still answers an ordinary analytics query with JSON and time functions', async () => {
      await call({ op: 'exec', sql: 'CREATE TABLE events (at_ts TIMESTAMP, payload VARCHAR, n INTEGER)' });
      await call({
        op: 'batch',
        sql: 'INSERT INTO events VALUES ($1, $2, $3)',
        rows: [
          ['2026-01-02 03:04:05', '{"kind":"a","v":{"x":1}}', 4],
          ['2026-01-20 10:00:00', '{"kind":"a","v":{"x":2}}', 6],
          ['2026-02-01 00:00:00', '{"kind":"b"}', null],
        ],
      });
      const answer = await call({
        op: 'query',
        sql: `SELECT strftime(date_trunc('month', at_ts), '%Y-%m') AS month, json_extract_string(payload, '$.kind') AS kind,
                coalesce(sum(n), 0) AS total, count(*) AS c, max(json_extract(payload, '$.v.x')::INTEGER) AS x
              FROM events GROUP BY ALL ORDER BY month`,
      }, 'ui');
      expect(answer).toEqual({
        ok: true,
        value: {
          columns: ['month', 'kind', 'total', 'c', 'x'],
          rows: [
            ['2026-01', 'a', '10', '2', 2],
            ['2026-02', 'b', '0', '1', null],
          ],
        },
      });
    });

    it('also refuses the logger controls inside the engine, and closing the store afterwards returns', async () => {
      const engine = createTrackingEngine({ extensionPath: extension, log: recordingLog().log });
      const file = join(rig.root, 'direct.duckdb');
      const db = await engine.open(file, 'c3'.repeat(32));
      await expect(db.query(`SELECT * FROM enable_logging(storage='file', storage_config={'path': '${dir()}'})`)).rejects.toThrow();
      await expect(db.run('CALL ENABLE_LOGGING()')).rejects.toThrow();
      await expect(db.session((s) => s.inspect('SELECT * FROM truncate_duckdb_logs()'))).rejects.toThrow();
      expect(await db.query('SELECT 1 AS one')).toEqual([{ one: 1 }]);
      db.close();
    });

    it('left the marker file untouched', () => {
      expect(readFileSync(join(rig.root, 'marker.csv'), 'utf8')).toBe('a,b\n1,MARKER\n');
    });
  });

  describe("what DuckDB's own parse allows, whatever the text looks like", () => {
    const dir = (): string => rig.root.split(String.fromCharCode(92)).join('/');
    const poison = (): string =>
      `enable' || '_logging(storage=''file'', storage_config={''path'': ''${dir()}''})`;
    const BACKSLASH = String.fromCharCode(92);
    const selects: Array<[string, () => string]> = [
      ['a nested comment before the call, concatenating the logger call', () => `SELECT * FROM query /* /* */ */ ('SELECT * FROM ${poison()}')`],
      ['an E-string and then a call', () => `SELECT E'it${BACKSLASH}'s' AS s FROM checkpoint()`],
      ['a no-break space before the parenthesis', () => 'SELECT * FROM checkpoint ()'],
      ['an ideographic space before the parenthesis', () => 'SELECT * FROM checkpoint　()'],
      ['an em space before the parenthesis', () => 'SELECT * FROM checkpoint ()'],
      ['a byte-order mark before the parenthesis', () => 'SELECT * FROM checkpoint﻿()'],
      ['PRAGMA database_list', () => 'PRAGMA database_list'],
      ['PRAGMA database_size', () => 'PRAGMA database_size'],
      ['PRAGMA platform', () => 'PRAGMA platform'],
      ['PRAGMA functions', () => 'PRAGMA functions'],
      ['lower case pragma with a trailing semicolon', () => 'pragma database_list;'],
      ['current_setting of the secret directory', () => "SELECT current_setting('secret_directory')"],
      ['nextval', () => "SELECT nextval('s')"],
      ['currval and setseed', () => "SELECT currval('s'), setseed(0.5)"],
      ['a function inside a subquery, a CTE and a window', () => "WITH x AS (SELECT * FROM (SELECT nextval('s')) q) SELECT sum(1) OVER () FROM x"],
      ['a function inside a lambda', () => "SELECT list_transform([1], x -> current_setting('s'))"],
      ['a bare current_catalog', () => 'SELECT current_catalog'],
      ['a bare current_schema with an alias', () => 'SELECT current_schema AS s'],
      ['a bare CURRENT_SCHEMA in a WHERE', () => 'SELECT 1 WHERE CURRENT_SCHEMA = 1'],
      ['json_serialize_sql itself', () => "SELECT json_serialize_sql('SELECT 1')"],
      ['a system view without parentheses', () => 'SELECT * FROM duckdb_tables'],
      ['the catalog schemas', () => 'SELECT * FROM information_schema.schemata'],
      ['sqlite_master', () => 'SELECT * FROM sqlite_master'],
      ['DESCRIBE', () => 'DESCRIBE drops'],
      ['SUMMARIZE', () => 'SELECT * FROM (SUMMARIZE drops)'],
    ];

    it.each(selects)('refuses %s from the worker and the screen', async (_label, make) => {
      const sql = make();
      const worker = await call({ op: 'query', sql });
      expect(worker.ok).toBe(false);
      expect(worker).toMatchObject({ code: 'bad_args' });
      expect(['statement_type', 'bind']).toContain((worker as { reason: string }).reason);
      const ui = await call({ op: 'query', sql }, 'ui');
      expect(ui.ok).toBe(false);
      expect(['not_granted', 'bad_args']).toContain((ui as { code: string }).code);
      expect((await call({ op: 'query', sql: 'SELECT 1' })).ok).toBe(true);
    });

    it.each(selects.filter(([label]) => !/space|mark/.test(label)))(
      'refuses %s with exactly statement_type for the worker and not_granted for the screen',
      async (_label, make) => {
        const sql = make();
        expect(await call({ op: 'query', sql })).toEqual(refusedWith('bad_args', 'statement_type'));
        expect(await call({ op: 'query', sql }, 'ui')).toEqual(refusedWith('not_granted'));
      },
    );

    const writes: Array<[string, () => string]> = [
      ['an INSERT … SELECT from query() with the logger call concatenated', () => `INSERT INTO drops (id, item) SELECT 1, a FROM query('SELECT * FROM ${poison()}')`],
      ['a quoted, upper-case query()', () => `INSERT INTO drops (id, item) SELECT 1, a FROM "QUERY"('SELECT 1')`],
      ['a comment inside the write', () => 'INSERT INTO drops (id) /* x */ VALUES (7001)'],
      ['a line comment inside the write', () => 'INSERT INTO drops (id) -- x\n VALUES (7001)'],
      ['a nested comment inside the write', () => 'INSERT INTO drops (id) /* /* */ */ VALUES (7001)'],
      ['an E-string in the write', () => `INSERT INTO drops (id, item) VALUES (7001, E'a${BACKSLASH}'b')`],
      ['a dollar-quoted string in the write', () => 'INSERT INTO drops (id, item) VALUES (7001, $$x$$)'],
      ['a no-break space before a call in the write', () => 'INSERT INTO drops (id) SELECT * FROM checkpoint ()'],
      ['a non-ASCII word in the write', () => 'INSERT INTO drops (id) SELECT 7001 AS é'],
      ['nextval in a write', () => "INSERT INTO drops (id) SELECT nextval('s')"],
      ['current_setting in a write', () => "UPDATE drops SET item = current_setting('secret_directory') WHERE id = 1"],
      ['a system table in a CREATE TABLE AS', () => 'CREATE TABLE leak AS SELECT * FROM duckdb_databases()'],
      ['a system view without parentheses in a CREATE VIEW', () => 'CREATE VIEW leak AS SELECT * FROM duckdb_databases'],
      ['a logger call in a macro body', () => 'CREATE MACRO leak() AS TABLE SELECT * FROM duckdb_databases()'],
      ['a default that calls nextval', () => "CREATE TABLE seqd (a INTEGER DEFAULT nextval('s'))"],
      ['a read_csv in a write', () => `INSERT INTO drops (id, item) SELECT 1, a FROM read_csv('${dir()}/marker.csv')`],
      ['a form feed', () => 'INSERT INTO drops (id)\fVALUES (7001)'],
    ];

    it.each(writes)('refuses %s from the worker with statement_type, and from the screen with not_granted', async (_label, make) => {
      const sql = make();
      const before = await count('drops');
      expect(await call({ op: 'exec', sql })).toEqual(refusedWith('bad_args', 'statement_type'));
      expect(await call({ op: 'query', sql })).toEqual(refusedWith('bad_args', 'statement_type'));
      expect(await call({ op: 'tx', steps: [{ sql }] })).toEqual(refusedWith('bad_args', 'statement_type'));
      expect(await call({ op: 'query', sql }, 'ui')).toEqual(refusedWith('not_granted'));
      expect(await count('drops')).toBe(before);
      expect((await call({ op: 'query', sql: 'SELECT 1' })).ok).toBe(true);
    });

    it('answers ordinary analytics: JSON, time, window, CTE, lambda and quantile', async () => {
      await call({
        op: 'exec',
        sql: 'CREATE TABLE IF NOT EXISTS ev (id INTEGER PRIMARY KEY, kind VARCHAR, at_ts TIMESTAMP, payload VARCHAR, n DOUBLE)',
      });
      await call({
        op: 'batch',
        sql: 'INSERT INTO ev VALUES ($1, $2, $3, $4, $5)',
        rows: [
          [1, 'a', '2026-01-02 03:04:05', '{"v":{"x":1}}', 1],
          [2, 'a', '2026-01-03 03:04:05', '{"v":{"x":2}}', 3],
          [3, 'b', '2026-02-01 00:00:00', '{"v":{"x":3}}', 5],
        ],
      });
      const answer = await call(
        {
          op: 'query',
          sql: `WITH monthly AS (
                  SELECT strftime(date_trunc('month', at_ts), '%Y-%m') AS month, kind, sum(n) AS total,
                         quantile_cont(n, 0.5) AS med, max(json_extract(payload, '$.v.x')::INTEGER) AS x
                  FROM ev GROUP BY ALL)
                SELECT month, kind, total, med, x,
                       sum(total) OVER (ORDER BY month ROWS UNBOUNDED PRECEDING) AS running,
                       list_transform([1, 2], v -> v * 2) AS doubled,
                       row_number() OVER (PARTITION BY kind ORDER BY month) AS rn
                FROM monthly
                ORDER BY month`,
        },
        'ui',
      );
      expect(answer).toMatchObject({
        ok: true,
        value: { columns: ['month', 'kind', 'total', 'med', 'x', 'running', 'doubled', 'rn'] },
      });
      expect((answer as { value: { rows: unknown[][] } }).value.rows).toEqual([
        ['2026-01', 'a', 4, 2, 2, 4, '[2,4]', '1'],
        ['2026-02', 'b', 5, 5, 3, 9, '[2,4]', '1'],
      ]);
    });

    it('lets the worker write with ON CONFLICT, MERGE, INSERT … SELECT and a view, using allowed functions', async () => {
      const steps = [
        "INSERT INTO ev (id, kind, n) VALUES (10, 'c', 1) ON CONFLICT (id) DO UPDATE SET n = ev.n + excluded.n",
        "INSERT INTO ev (id, kind, n) VALUES (10, 'c', 1) ON CONFLICT (id) DO UPDATE SET n = ev.n + excluded.n",
        "MERGE INTO ev USING (SELECT 11 AS id, 'd' AS kind) s ON ev.id = s.id WHEN NOT MATCHED THEN INSERT (id, kind) VALUES (s.id, upper(s.kind))",
        "INSERT INTO ev (id, kind) SELECT 12 + range, lower('E') FROM range(2)",
        "UPDATE ev SET kind = coalesce(kind, 'z') || '!' WHERE id IN (SELECT id FROM ev WHERE length(kind) > 0 AND id >= 10)",
        'CREATE VIEW IF NOT EXISTS ev_totals AS SELECT kind, sum(n) AS total FROM ev GROUP BY kind',
      ];
      for (const sql of steps) expect(await call({ op: 'exec', sql })).toMatchObject({ ok: true });
      const answer = await call({ op: 'query', sql: 'SELECT total FROM ev_totals WHERE kind = $1', params: ['c!'] });
      expect(answer).toEqual({ ok: true, value: { columns: ['total'], rows: [[2]] } });
    });

    it('left the marker file untouched and the screen could not write', async () => {
      expect(readFileSync(join(rig.root, 'marker.csv'), 'utf8')).toBe('a,b\n1,MARKER\n');
      expect(await count('drops WHERE id = 7001')).toBe(0);
    });
  });

  describe('all or nothing', () => {
    it('a batch whose last row fails leaves no row', async () => {
      const answer = await call({
        op: 'batch',
        sql: 'INSERT INTO drops (id, item) VALUES ($1, $2)',
        rows: [
          [6000, 'a'],
          [6001, 'b'],
          [6000, 'dup'],
        ],
      });
      expect(answer).toEqual(refusedWith('failed', 'constraint'));
      expect(await count('drops WHERE id >= 6000 AND id < 7000')).toBe(0);
    });

    it('a tx whose last step fails leaves no row and no created table', async () => {
      const answer = await call({
        op: 'tx',
        steps: [
          { sql: 'CREATE TABLE half_made (a INTEGER)' },
          { sql: 'INSERT INTO drops (id) VALUES (6100)' },
          { sql: 'INSERT INTO drops (id) VALUES (6100)' },
        ],
      });
      expect(answer).toEqual(refusedWith('failed', 'constraint'));
      expect(await count('drops WHERE id = 6100')).toBe(0);
      expect(await call({ op: 'query', sql: 'SELECT * FROM half_made' })).toEqual(refusedWith('bad_args', 'bind'));
    });

    it('the handle stays usable for a write after a refused tx', async () => {
      expect((await call({ op: 'exec', sql: 'INSERT INTO drops (id) VALUES (6200)' })).ok).toBe(true);
    });
  });

  describe('each DuckDB error type maps to its reason', () => {
    it('constraint', async () => {
      expect(await call({ op: 'exec', sql: 'INSERT INTO drops (id) VALUES ($1)', params: [1] })).toEqual(refusedWith('failed', 'constraint'));
    });
    it('conversion', async () => {
      expect(await call({ op: 'exec', sql: 'INSERT INTO drops (id) VALUES ($1)', params: ['not a number'] })).toEqual(
        refusedWith('failed', 'conversion'),
      );
    });
  });

  describe('limits', () => {
    it('answers 10,000 rows and refuses 10,001 with rows and nothing returned', async () => {
      const ok = await call({ op: 'query', sql: 'SELECT i FROM range($1) t(i)', params: [TRACKING_DB_LIMITS.resultRows] });
      expect(ok.ok && (ok.value as { rows: unknown[] }).rows).toHaveLength(TRACKING_DB_LIMITS.resultRows);
      expect(await call({ op: 'query', sql: 'SELECT i FROM range($1) t(i)', params: [TRACKING_DB_LIMITS.resultRows + 1] })).toEqual(
        refusedWith('too_large', 'rows'),
      );
      expect((await call({ op: 'query', sql: 'SELECT 1' })).ok).toBe(true);
    });

    it('refuses more than 8 MiB of values with bytes', async () => {
      expect(await call({ op: 'query', sql: "SELECT repeat('x', 1024 * 1024) AS s FROM range(9)" })).toEqual(refusedWith('too_large', 'bytes'));
    });

    it('refuses over the sql, param, row, step and write-byte limits and writes nothing', async () => {
      const before = await count('drops');
      expect(await call({ op: 'exec', sql: `SELECT '${'x'.repeat(TRACKING_DB_LIMITS.sqlBytes)}'` })).toEqual(refusedWith('too_large', 'bytes'));
      const many = Array.from({ length: TRACKING_DB_LIMITS.params + 1 }, () => 1);
      expect(await call({ op: 'query', sql: 'SELECT 1', params: many })).toEqual(refusedWith('too_large', 'params'));
      expect(
        await call({ op: 'batch', sql: 'INSERT INTO drops (id) VALUES ($1)', rows: Array.from({ length: TRACKING_DB_LIMITS.batchRows + 1 }, (_, i) => [7000 + i]) }),
      ).toEqual(refusedWith('too_large', 'params'));
      expect(
        await call({ op: 'tx', steps: Array.from({ length: TRACKING_DB_LIMITS.txSteps + 1 }, (_, i) => ({ sql: `INSERT INTO drops (id) VALUES (${String(20000 + i)})` })) }),
      ).toEqual(refusedWith('too_large', 'params'));
      const fat = 'y'.repeat(1024 * 1024);
      expect(
        await call({ op: 'batch', sql: 'INSERT INTO drops (id, item) VALUES ($1, $2)', rows: [[8000, fat], [8001, fat], [8002, fat], [8003, fat], [8004, fat]] }),
      ).toEqual(refusedWith('too_large', 'bytes'));
      expect(
        await call({ op: 'tx', steps: [8010, 8011, 8012, 8013, 8014].map((id) => ({ sql: 'INSERT INTO drops (id, item) VALUES ($1, $2)', params: [id, fat] })) }),
      ).toEqual(refusedWith('too_large', 'bytes'));
      expect(await count('drops')).toBe(before);
    });

    it('accepts exactly the largest batch', async () => {
      const answer = await call({
        op: 'batch',
        sql: 'INSERT INTO drops (id) VALUES ($1)',
        rows: Array.from({ length: TRACKING_DB_LIMITS.batchRows }, (_, i) => [100000 + i]),
      });
      expect(answer).toEqual({ ok: true, value: { changes: TRACKING_DB_LIMITS.batchRows } });
    });
  });

  describe('shapes', () => {
    it.each([
      ['not an object', 'query'],
      ['no op', {}],
      ['an unknown op', { op: 'drop' }],
      ['sql that is not a string', { op: 'exec', sql: 5 }],
      ['params that are not a list', { op: 'exec', sql: 'SELECT 1', params: 'x' }],
      ['a param that is an object', { op: 'exec', sql: 'SELECT $1', params: [{}] }],
      ['a param that is not finite', { op: 'exec', sql: 'SELECT $1', params: [Infinity] }],
      ['rows that are not lists', { op: 'batch', sql: 'SELECT 1', rows: 3 }],
      ['rows of different widths', { op: 'batch', sql: 'INSERT INTO drops (id) VALUES ($1)', rows: [[1], [1, 2]] }],
      ['steps that are not a list', { op: 'tx', steps: {} }],
      ['a step without sql', { op: 'tx', steps: [{}] }],
    ])('refuses %s with shape', async (_label, args) => {
      expect(await call(args as never)).toEqual(refusedWith('bad_args', 'shape'));
    });
  });
});

describe('the statement timeout', () => {
  const SLOW = 'SELECT count(*) FROM range(100000000000) a, range(1000000) b';
  const SLOW_WRITE = `INSERT INTO t ${SLOW}`;

  it('interrupts a slow statement and answers timeout with no reason, and the file stays usable', async () => {
    const rig = realRig({ statementMs: 300 });
    await outcome(rig.handler, { op: 'exec', sql: 'CREATE TABLE t (n BIGINT)' });
    const started = Date.now();
    expect(await outcome(rig.handler, { op: 'query', sql: SLOW })).toEqual(refusedWith('timeout'));
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(await outcome(rig.handler, { op: 'exec', sql: 'INSERT INTO t VALUES (1)' })).toEqual({ ok: true, value: { changes: 1 } });
    await rig.store.close();
  }, 30_000);

  it('rolls a slow tx back whole, and the next write still commits', async () => {
    const rig = realRig({ statementMs: 300 });
    await outcome(rig.handler, { op: 'exec', sql: 'CREATE TABLE t (n BIGINT)' });
    const answer = await outcome(rig.handler, {
      op: 'tx',
      steps: [{ sql: 'INSERT INTO t VALUES (1)' }, { sql: SLOW_WRITE }],
    });
    expect(answer).toEqual(refusedWith('timeout'));
    const rows = await outcome(rig.handler, { op: 'query', sql: 'SELECT count(*) FROM t' });
    expect(rows).toEqual({ ok: true, value: { columns: ['count_star()'], rows: [['0']] } });
    expect(await outcome(rig.handler, { op: 'tx', steps: [{ sql: 'INSERT INTO t VALUES (2)' }] })).toEqual({ ok: true, value: { changes: [1] } });
    await rig.store.close();
  }, 30_000);

  it('times a batch as a whole', async () => {
    const rig = realRig({ statementMs: 300 });
    await outcome(rig.handler, { op: 'exec', sql: 'CREATE TABLE t (n BIGINT)' });
    const answer = await outcome(rig.handler, {
      op: 'batch',
      sql: 'INSERT INTO t SELECT count(*) FROM range($1) a, range(1000000) b',
      rows: [[100000000000]],
    });
    expect(answer).toEqual(refusedWith('timeout'));
    expect(await outcome(rig.handler, { op: 'query', sql: 'SELECT count(*) FROM t' })).toMatchObject({ value: { rows: [['0']] } });
    await rig.store.close();
  }, 30_000);
});

describe('status answers every unavailable reason', () => {
  it('no_subject', async () => {
    const rig = realRig({ subject: null });
    expect(await outcome(rig.handler, { op: 'status' })).toEqual({ ok: true, value: { state: 'unavailable', reason: 'no_subject' } });
    expect(await outcome(rig.handler, { op: 'query', sql: 'SELECT 1' })).toEqual(refusedWith('unavailable', 'no_subject'));
    expect(await outcome(rig.handler, { op: 'size' })).toEqual(refusedWith('unavailable', 'no_subject'));
    await rig.store.close();
  });

  it('no_secure_storage', async () => {
    const rig = realRig({ rows: memoryRows({ available: false }) });
    expect(await outcome(rig.handler, { op: 'status' })).toEqual({ ok: true, value: { state: 'unavailable', reason: 'no_secure_storage' } });
    expect(await outcome(rig.handler, { op: 'exec', sql: 'SELECT 1' })).toEqual(refusedWith('unavailable', 'no_secure_storage'));
    await rig.store.close();
  });

  it('db_unreadable: a file with no key to open it', async () => {
    const first = realRig();
    await outcome(first.handler, { op: 'exec', sql: 'CREATE TABLE t (a INTEGER)' });
    await first.store.close();
    const again = createDbCapability({
      subject: () => ALICE,
      store: createTrackingStore({
        root: first.root,
        rows: memoryRows(),
        engine: createTrackingEngine({ extensionPath: extension, log: recordingLog().log }),
        closeWaitMs: 50,
      }),
      mono: () => 0,
      log: recordingLog().log,
    });
    expect(await outcome(again, { op: 'status' })).toEqual({ ok: true, value: { state: 'unavailable', reason: 'db_unreadable' } });
    expect(await outcome(again, { op: 'query', sql: 'SELECT 1' })).toEqual(refusedWith('unavailable', 'db_unreadable'));
  });

  it('engine_unavailable: the binding is missing', async () => {
    const root = join(scratch, `rig-${String((counter += 1))}`);
    mkdirSync(root, { recursive: true });
    const engine = createTrackingEngine({
      extensionPath: extension,
      log: recordingLog().log,
      loadBinding: () => {
        throw new Error('no binding');
      },
    });
    const store = createTrackingStore({ root, rows: memoryRows(), engine });
    const handler = createDbCapability({ subject: () => ALICE, store, mono: () => 0, log: recordingLog().log });
    expect(await outcome(handler, { op: 'status' })).toEqual({ ok: true, value: { state: 'unavailable', reason: 'engine_unavailable' } });
    expect(await outcome(handler, { op: 'exec', sql: 'SELECT 1' })).toEqual(refusedWith('unavailable', 'engine_unavailable'));
  });

  it('clearing: while the history is being deleted', async () => {
    const root = join(scratch, `rig-${String((counter += 1))}`);
    mkdirSync(root, { recursive: true });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const store = createTrackingStore({
      root,
      rows: memoryRows(),
      engine: createTrackingEngine({ extensionPath: extension, log: recordingLog().log }),
      fs: {
        removeFile: async (path) => {
          await gate;
          rmSync(path, { force: true });
        },
      },
      closeWaitMs: 50,
    });
    const handler = createDbCapability({ subject: () => ALICE, store, mono: () => 0, log: recordingLog().log });
    await outcome(handler, { op: 'exec', sql: 'CREATE TABLE t (a INTEGER)' });
    const clearing = store.clear(ALICE);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await outcome(handler, { op: 'status' })).toEqual({ ok: true, value: { state: 'unavailable', reason: 'clearing' } });
    expect(await outcome(handler, { op: 'query', sql: 'SELECT 1' })).toEqual(refusedWith('unavailable', 'clearing'));
    release();
    await clearing;
    expect(await outcome(handler, { op: 'status' })).toEqual({ ok: true, value: { state: 'ready' } });
    await store.close();
  });
});

describe('engine errors map by kind, with a scripted session', () => {
  function scripted(kind: StatementErrorKind | 'plain') {
    const session: DbSession = {
      count: () => Promise.resolve(1),
      inspect: () => Promise.resolve({ count: 1, type: 'INSERT', parameters: 0 }),
      run: () => Promise.reject(kind === 'plain' ? new Error('ENGINE TEXT SELECT secret FROM vault') : new EngineStatementError(kind)),
      query: (sql) =>
        Promise.resolve({ columns: ['j'], rows: sql.includes('json_serialize_sql') ? [['{"error":true}']] : [] }),
      interrupt: () => undefined,
    };
    const store = {
      status: () => ({ state: 'none' }),
      db: () => Promise.resolve({ session: <T>(fn: (s: DbSession) => Promise<T>) => fn(session) }),
      close: () => Promise.resolve(),
      clear: () => Promise.resolve('cleared'),
    } as unknown as TrackingStore;
    const { log, records } = recordingLog();
    return { records, handler: createDbCapability({ subject: () => ALICE, store, mono: () => 0, log }) };
  }

  it.each([
    ['disk_full', 'failed', 'disk_full'],
    ['constraint', 'failed', 'constraint'],
    ['catalog', 'failed', 'catalog'],
    ['conversion', 'failed', 'conversion'],
    ['other', 'failed', 'other'],
    ['plain', 'failed', 'other'],
    ['interrupted', 'timeout', undefined],
    ['bind', 'bad_args', 'bind'],
  ] as const)('%s becomes %s/%s', async (kind, code, reason) => {
    const { handler } = scripted(kind);
    expect(await outcome(handler, { op: 'exec', sql: 'INSERT INTO t VALUES (1)' })).toEqual(refusedWith(code, reason));
  });

  it('an unavailable error from a handle call (the store closed under it) is unavailable with its reason', async () => {
    const store = {
      status: () => ({ state: 'none' }),
      db: () =>
        Promise.resolve({
          session: () => Promise.reject(new TrackingUnavailableError('clearing')),
        }),
    } as unknown as TrackingStore;
    const handler = createDbCapability({ subject: () => ALICE, store, mono: () => 0, log: recordingLog().log });
    expect(await outcome(handler, { op: 'query', sql: 'SELECT 1' })).toEqual(refusedWith('unavailable', 'clearing'));
  });
});

describe('the audit', () => {
  it('writes one premium.db record per call with scalar fields only and never the sql, params or engine text', async () => {
    const rig = realRig();
    const SQL_MARKER = 'sql_marker_5521';
    const PARAM_MARKER = 'param-marker-9034';
    await outcome(rig.handler, { op: 'exec', sql: `CREATE TABLE ${SQL_MARKER} (v VARCHAR PRIMARY KEY)` });
    await outcome(rig.handler, { op: 'exec', sql: `INSERT INTO ${SQL_MARKER} VALUES ($1)`, params: [PARAM_MARKER] });
    const dup = await outcome(rig.handler, { op: 'exec', sql: `INSERT INTO ${SQL_MARKER} VALUES ($1)`, params: [PARAM_MARKER] });
    await outcome(rig.handler, { op: 'query', sql: `SELECT * FROM ${SQL_MARKER}_missing` }, 'ui');
    await outcome(rig.handler, { op: 'tx', steps: [{ sql: `DELETE FROM ${SQL_MARKER}` }, { sql: `DELETE FROM ${SQL_MARKER}` }] });
    await outcome(rig.handler, { op: 'size' });

    const audits = rig.records.filter((record) => record['event'] === 'premium.db');
    expect(audits).toEqual([
      { scope: 'premium', event: 'premium.db', op: 'exec', outcome: 'ok', ms: 3, origin: 'worker', steps: 1 },
      { scope: 'premium', event: 'premium.db', op: 'exec', outcome: 'ok', ms: 3, origin: 'worker', steps: 1 },
      { scope: 'premium', event: 'premium.db', op: 'exec', outcome: 'failed', reason: 'constraint', ms: 3, origin: 'worker', steps: 1 },
      { scope: 'premium', event: 'premium.db', op: 'query', outcome: 'bad_args', reason: 'bind', ms: 3, origin: 'ui', steps: 1 },
      { scope: 'premium', event: 'premium.db', op: 'tx', outcome: 'ok', ms: 3, origin: 'worker', steps: 2 },
      { scope: 'premium', event: 'premium.db', op: 'size', outcome: 'ok', ms: 3, origin: 'worker', steps: 1 },
    ]);
    expect(dup).toEqual(refusedWith('failed', 'constraint'));
    const everything = JSON.stringify(rig.records);
    expect(everything).not.toContain(SQL_MARKER);
    expect(everything).not.toContain(PARAM_MARKER);
    expect(everything).not.toContain('Constraint Error');
    expect(everything).not.toContain('violates');
    await rig.store.close();
  });

  it('never puts engine text in a reply', async () => {
    const rig = realRig();
    await outcome(rig.handler, { op: 'exec', sql: 'CREATE TABLE t (a INTEGER PRIMARY KEY)' });
    await outcome(rig.handler, { op: 'exec', sql: 'INSERT INTO t VALUES (1)' });
    try {
      await (rig.handler as (a: unknown, c: { origin: CallOrigin }) => unknown)(
        { op: 'exec', sql: 'INSERT INTO t VALUES (1)' },
        { origin: 'worker' },
      );
      throw new Error('expected a refusal');
    } catch (error) {
      expect(error).toBeInstanceOf(CapabilityError);
      expect((error as Error).message).toBe('failed');
      expect((error as CapabilityError).reason).toBe('constraint');
    }
    await rig.store.close();
  });
});
