import { TRACKING_DB_LOCK, TRACKING_DB_OPEN_CONFIG } from '@bombfarm/contracts';
import type { LogPort } from '../../storage/index.js';

export type EngineProbe =
  | { ok: true; version: string }
  | { ok: false; reason: 'binding_missing' | 'extension_missing' | 'probe_failed' };

/** The part of the DuckDB binding the engine uses; no other module names the package. */
export interface DuckConnection {
  /** Resolves with a result that carries `rowsChanged`. */
  run(sql: string, values?: unknown[]): Promise<unknown>;
  runAndReadAll(sql: string, values?: unknown[]): Promise<{ getRowObjectsJS(): Record<string, unknown>[] }>;
  streamAndReadUntil(sql: string, targetRowCount: number, values?: unknown[]): Promise<DuckRows>;
  extractStatements(sql: string): Promise<{
    readonly count: number;
    prepare(index: number): Promise<{ readonly statementType: number; readonly parameterCount: number }>;
  }>;
  interrupt(): void;
  closeSync(): void;
}
export interface DuckRows {
  columnNames(): string[];
  getRowsJson(): unknown[][];
}
export interface DuckInstance {
  connect(): Promise<DuckConnection>;
  closeSync(): void;
}
export interface DuckBinding {
  /** The statement-type enum: numeric value to name. */
  StatementType: Record<number, string | undefined>;
  DuckDBInstance: { create(path: string, options: Record<string, string>): Promise<DuckInstance> };
}

/** What the engine knows about the first statement of a string, from DuckDB's own parser. */
export interface StatementInfo {
  /** How many statements the string holds. */
  count: number;
  /** DuckDB's name for the first statement's type (`SELECT`, `INSERT`, `MERGE_INTO` …). */
  type: string;
  /** How many positional parameters the first statement takes. */
  parameters: number;
}

/** Why a statement failed, by DuckDB's error type; never its text. */
export type StatementErrorKind =
  | 'bind'
  | 'disk_full'
  | 'constraint'
  | 'catalog'
  | 'conversion'
  | 'interrupted'
  | 'other';

export class EngineStatementError extends Error {
  constructor(readonly kind: StatementErrorKind) {
    super(kind);
    this.name = 'EngineStatementError';
  }
}

export interface DbRows {
  columns: string[];
  /** DuckDB's JSON form of each value: BIGINT, HUGEINT, DECIMAL and dates are strings. */
  rows: unknown[][];
}

/** One connection for the length of a `session` call; every method rejects `EngineStatementError`. */
export interface DbSession {
  /** How many statements the string holds. Parses only: nothing is bound or run. A parse failure is kind `bind`. */
  count(sql: string): Promise<number>;
  /** Parses and prepares the string's first statement (this binds it); a parse or bind failure is kind `bind`. */
  inspect(sql: string): Promise<StatementInfo>;
  /** Runs one statement; answers the rows it changed. */
  run(sql: string, params?: readonly unknown[]): Promise<number>;
  /** Runs one statement and reads at least `maxRows` rows (possibly a chunk more) or all of them. */
  query(sql: string, params: readonly unknown[] | undefined, maxRows: number): Promise<DbRows>;
  /** Aborts the statement in flight; safe from any timer. */
  interrupt(): void;
}

/** An open, locked database: the first statement a caller runs is already under the lock. */
export interface LockedDb {
  run(sql: string, params?: readonly unknown[]): Promise<void>;
  query(sql: string, params?: readonly unknown[]): Promise<Record<string, unknown>[]>;
  /** `fn` runs alone on the connection: no other call interleaves until it settles. */
  session<T>(fn: (session: DbSession) => Promise<T>): Promise<T>;
  /** Idempotent. */
  close(): void;
}

export type EngineOpenReason =
  | 'binding_missing'
  | 'bad_key'
  | 'extension_failed'
  | 'attach_failed'
  | 'lock_failed'
  | 'settings_unexpected';

export class EngineOpenError extends Error {
  constructor(
    readonly reason: EngineOpenReason,
    cause?: unknown,
  ) {
    super(reason, cause === undefined ? undefined : { cause });
    this.name = 'EngineOpenError';
  }
}

const OPEN_DETAIL_MAX = 300;

/** The engine's own words for a failed open, for the log: without the key, its hashes or any path. */
function openFailureDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/[0-9a-f]{32,}/gi, '[hex]')
    .replace(/(?:[A-Za-z]:)?[\\/][^\x22\x27\n]*/g, '[path]')
    .slice(0, OPEN_DETAIL_MAX);
}

export interface TrackingEngine {
  /** The one start-up probe. Runs on the first call, answers the same value afterwards; never throws. */
  probe(): Promise<EngineProbe>;
  /** Throws `EngineOpenError`; on any failure the instance is already closed. */
  open(file: string, keyHex: string): Promise<LockedDb>;
}

export interface TrackingEngineDeps {
  /** Where the signed extension is shipped; never a path premium code supplies. */
  extensionPath: string;
  log: LogPort;
  /** Test seam: how the binding is loaded. Defaults to a lazy `require`. */
  loadBinding?: () => DuckBinding;
}

/** What the four settings must read back as once the lock is on, in this order. */
const LOCKED_SETTINGS = [
  ['enable_external_access', 'false'],
  ['lock_configuration', 'true'],
  ['autoload_known_extensions', 'false'],
  ['allow_unsigned_extensions', 'false'],
] as const;

/** The name the tracking file is attached under. */
const ALIAS = 'track';
const KEY_HEX = /^[0-9a-f]{64}$/;

function lit(value: string): string {
  return `'${value.split('\\').join('/').replace(/'/g, "''")}'`;
}

function lazyBinding(): DuckBinding {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@duckdb/node-api') as DuckBinding;
}

/**
 * The logger's control functions run despite the lock: pointed at a folder the lock forbids, they
 * leave a connection that fails every call and takes the process down when it closes. The caller
 * gates function names too; this is the engine's own refusal, so no caller can reach them.
 */
const LOGGER_CONTROL = /(?:enable|disable)_logging|truncate_duckdb_logs/i;

function refuseLoggerControl(sql: string): void {
  if (LOGGER_CONTROL.test(sql)) throw new EngineStatementError('other');
}

function statementKind(error: unknown): StatementErrorKind {
  const message = error instanceof Error ? error.message : '';
  switch (/^([A-Za-z ]+?) Error:/.exec(message)?.[1]?.toLowerCase()) {
    case 'constraint':
      return 'constraint';
    case 'catalog':
      return 'catalog';
    case 'conversion':
      return 'conversion';
    case 'interrupt':
      return 'interrupted';
    case 'io':
      return /no space left|not enough space|enospc/i.test(message) ? 'disk_full' : 'other';
    default:
      return 'other';
  }
}

/**
 * A connection the logger has been pointed somewhere the lock forbids fails every statement, and
 * DuckDB then aborts the process when it closes the connection. The tell is a permission failure
 * that a plain `SELECT 1` cannot get past; such a handle is never closed natively, only dropped
 * (the write-ahead log covers its data).
 */
interface Poison {
  poisoned: boolean;
}

async function checkPoison(db: DuckConnection, poison: Poison, error: unknown): Promise<void> {
  if (poison.poisoned || !/^Permission Error/i.test(error instanceof Error ? error.message : '')) return;
  try {
    await db.runAndReadAll('SELECT 1');
  } catch {
    poison.poisoned = true;
  }
}

async function classified<T>(db: DuckConnection, poison: Poison, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    await checkPoison(db, poison, error);
    throw new EngineStatementError(statementKind(error));
  }
}

function sessionOf(binding: DuckBinding, db: DuckConnection, poison: Poison): DbSession {
  return {
    async count(sql) {
      try {
        return (await db.extractStatements(sql)).count;
      } catch {
        throw new EngineStatementError('bind');
      }
    },
    async inspect(sql) {
      refuseLoggerControl(sql);
      try {
        const extracted = await db.extractStatements(sql);
        // Only a lone statement is prepared: with two, the caller refuses on the count alone.
        if (extracted.count !== 1) return { count: extracted.count, type: '', parameters: 0 };
        const prepared = await extracted.prepare(0);
        return {
          count: extracted.count,
          type: binding.StatementType[prepared.statementType] ?? 'INVALID',
          parameters: prepared.parameterCount,
        };
      } catch (error) {
        await checkPoison(db, poison, error);
        throw new EngineStatementError('bind');
      }
    },
    async run(sql, params) {
      refuseLoggerControl(sql);
      const result = await classified(db, poison, () => db.run(sql, params === undefined ? undefined : [...params]));
      const changed = (result as { rowsChanged?: unknown } | null)?.rowsChanged;
      return typeof changed === 'number' ? changed : 0;
    },
    async query(sql, params, maxRows) {
      refuseLoggerControl(sql);
      const reader = await classified(db, poison, () =>
        db.streamAndReadUntil(sql, maxRows, params === undefined ? undefined : [...params]),
      );
      return { columns: reader.columnNames(), rows: reader.getRowsJson() };
    },
    interrupt() {
      db.interrupt();
    },
  };
}

function closeQuietly(instance: DuckInstance, connection: DuckConnection | null): void {
  try {
    connection?.closeSync();
  } catch {
    // best-effort: the instance close below releases it anyway
  }
  try {
    instance.closeSync();
  } catch {
    // best-effort close of an instance that already failed
  }
}

export function createTrackingEngine(deps: TrackingEngineDeps): TrackingEngine {
  const loadBinding = deps.loadBinding ?? lazyBinding;
  let probed: Promise<EngineProbe> | null = null;

  async function runProbe(): Promise<EngineProbe> {
    let binding: DuckBinding;
    try {
      binding = loadBinding();
    } catch {
      return { ok: false, reason: 'binding_missing' };
    }
    let instance: DuckInstance | null = null;
    let connection: DuckConnection | null = null;
    try {
      instance = await binding.DuckDBInstance.create(':memory:', { ...TRACKING_DB_OPEN_CONFIG });
      connection = await instance.connect();
      try {
        await connection.run(`LOAD ${lit(deps.extensionPath)}`);
      } catch {
        return { ok: false, reason: 'extension_missing' };
      }
      const [row] = (await connection.runAndReadAll('SELECT version() AS v, 40 + 2 AS answer')).getRowObjectsJS();
      if (row === undefined || Number(row['answer']) !== 42 || typeof row['v'] !== 'string') {
        return { ok: false, reason: 'probe_failed' };
      }
      return { ok: true, version: row['v'] };
    } catch {
      return { ok: false, reason: 'probe_failed' };
    } finally {
      if (instance !== null) closeQuietly(instance, connection);
    }
  }

  function probe(): Promise<EngineProbe> {
    probed ??= runProbe().then(
      (result) => {
        report(result);
        return result;
      },
      () => {
        const result: EngineProbe = { ok: false, reason: 'probe_failed' };
        report(result);
        return result;
      },
    );
    return probed;
  }

  function report(result: EngineProbe): void {
    const record = result.ok
      ? { scope: 'premium', event: 'premium.tracking_probe', outcome: 'ok', version: result.version }
      : { scope: 'premium', event: 'premium.tracking_probe', outcome: result.reason };
    try {
      if (result.ok) deps.log.info(record);
      else deps.log.warn(record);
    } catch {
      // a failing log must not turn the probe into a throw
    }
  }

  async function open(file: string, keyHex: string): Promise<LockedDb> {
    if (!KEY_HEX.test(keyHex)) throw new EngineOpenError('bad_key');
    let binding: DuckBinding;
    try {
      binding = loadBinding();
    } catch (error) {
      throw new EngineOpenError('binding_missing', error);
    }

    let instance: DuckInstance | null = null;
    let connection: DuckConnection | null = null;
    let step: EngineOpenReason = 'extension_failed';
    try {
      instance = await binding.DuckDBInstance.create(':memory:', { ...TRACKING_DB_OPEN_CONFIG });
      connection = await instance.connect();
      await connection.run(`LOAD ${lit(deps.extensionPath)}`);
      step = 'attach_failed';
      await connection.run(`ATTACH ${lit(file)} AS ${ALIAS} (ENCRYPTION_KEY '${keyHex}')`);
      await connection.run(`USE ${ALIAS}`);
      step = 'lock_failed';
      for (const [name, value] of TRACKING_DB_LOCK) {
        await connection.run(`SET ${name} = ${value}`);
      }
      step = 'settings_unexpected';
      for (const [name, expected] of LOCKED_SETTINGS) {
        const [row] = (await connection.runAndReadAll(`SELECT current_setting('${name}') AS v`)).getRowObjectsJS();
        if (row === undefined || String(row['v']) !== expected) throw new Error(`${name} did not read back`);
      }
    } catch (error) {
      if (instance !== null) closeQuietly(instance, connection);
      deps.log.warn({ scope: 'premium', event: 'premium.tracking_open_failed', step, detail: openFailureDetail(error) });
      throw error instanceof EngineOpenError ? error : new EngineOpenError(step, error);
    }

    const db = connection;
    const owner = instance;
    let closed = false;
    const poison: Poison = { poisoned: false };
    return {
      async run(sql, params) {
        refuseLoggerControl(sql);
        await classified(db, poison, () => db.run(sql, params === undefined ? undefined : [...params]));
      },
      async query(sql, params) {
        refuseLoggerControl(sql);
        const reader = await classified(db, poison, () =>
          db.runAndReadAll(sql, params === undefined ? undefined : [...params]),
        );
        return reader.getRowObjectsJS();
      },
      session: (fn) => fn(sessionOf(binding, db, poison)),
      close() {
        if (closed) return;
        closed = true;
        // A poisoned handle is abandoned: closing it would abort the process.
        if (poison.poisoned) return;
        closeQuietly(owner, db);
      },
    };
  }

  return { probe, open };
}
