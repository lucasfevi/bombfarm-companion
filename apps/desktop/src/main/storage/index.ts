import fs from 'node:fs';
import type { AccountStoreReason } from '@bombfarm/contracts';
import { INIT_ACCOUNT_SQL, SCHEMA_VERSION } from './account-schema.js';

export type SqliteBinding = 'node:sqlite' | 'better-sqlite3';

export interface StorageHealth {
  binding: SqliteBinding;
  ok: boolean;
}

export interface Storage {
  binding: SqliteBinding;
  healthCheck(): StorageHealth;
  close(): void;
}

/** The intersection of `node:sqlite` and `better-sqlite3`'s statement API. */
export interface SqliteStatement {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

/** The intersection of `node:sqlite` and `better-sqlite3`'s database-handle API. */
export interface SqliteDb {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

/** Structured logging, injected so `storage/*.ts` never imports `../logging.js` directly —
 * `electron-log/main.js` cannot be imported outside a running Electron process, and
 * this module must stay importable on `ubuntu-latest` with no running app. */
export interface LogPort {
  info(record: Record<string, unknown>): void;
  warn(record: Record<string, unknown>): void;
  error(record: Record<string, unknown>): void;
}

const NOOP_LOG_PORT: LogPort = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS storage_health (
    id INTEGER PRIMARY KEY,
    checked_at TEXT NOT NULL
  );
`;

function openRawBetterSqlite3(dbPath: string): SqliteDb {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3') as new (path: string) => SqliteDb;
  return new Database(dbPath);
}

function openRawNodeSqlite(dbPath: string): SqliteDb {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: new (path: string) => SqliteDb;
  };
  return new DatabaseSync(dbPath);
}

function openWithNodeSqlite(dbPath: string): SqliteDb {
  const db = openRawNodeSqlite(dbPath);
  db.exec(INIT_SQL);
  return db;
}

function openWithBetterSqlite3(dbPath: string): SqliteDb {
  const db = openRawBetterSqlite3(dbPath);
  db.exec(INIT_SQL);
  return db;
}

function tryOpenBetterSqlite3(dbPath: string): SqliteDb | null {
  try {
    return openWithBetterSqlite3(dbPath);
  } catch {
    return null;
  }
}

function tryOpenRawBetterSqlite3(dbPath: string): SqliteDb | null {
  try {
    return openRawBetterSqlite3(dbPath);
  } catch {
    return null;
  }
}

/** Prefer better-sqlite3 when its native binding is usable; otherwise node:sqlite (D5). */
export function detectSqliteBinding(): SqliteBinding {
  const probePath = ':memory:';
  if (tryOpenBetterSqlite3(probePath)) {
    return 'better-sqlite3';
  }
  return 'node:sqlite';
}

export function createStorage(dbPath: string): Storage {
  const betterDb = tryOpenBetterSqlite3(dbPath);
  const binding: SqliteBinding = betterDb ? 'better-sqlite3' : 'node:sqlite';
  const db = betterDb ?? openWithNodeSqlite(dbPath);

  return {
    binding,
    healthCheck() {
      return { binding, ok: true };
    },
    close() {
      db.close();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Account database — the platform boundary for persistence.
// ---------------------------------------------------------------------------------------------

/** `(dbPath) => { db, binding }`, throwing when the path cannot be opened at all. */
export type SqliteOpener = (dbPath: string) => { db: SqliteDb; binding: SqliteBinding };

const WRITE_PERMISSION_ERROR_CODES = new Set(['EACCES', 'EPERM', 'SQLITE_CANTOPEN']);

function isNotWritableError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === 'string' && WRITE_PERMISSION_ERROR_CODES.has(code);
  }
  return false;
}

/** Try better-sqlite3 first (the fallback shape decided for the SQLite binding at M0); fall back to node:sqlite. */
function defaultSqliteOpener(dbPath: string): { db: SqliteDb; binding: SqliteBinding } {
  const betterDb = tryOpenRawBetterSqlite3(dbPath);
  if (betterDb) {
    return { db: betterDb, binding: 'better-sqlite3' };
  }
  return { db: openRawNodeSqlite(dbPath), binding: 'node:sqlite' };
}

export interface OpenAccountDatabaseDeps {
  open?: SqliteOpener;
  log?: LogPort;
}

export interface OpenResult {
  status: 'ok' | 'degraded' | 'unavailable';
  db: SqliteDb | null;
  binding: SqliteBinding | null;
  reason: AccountStoreReason | null;
}

interface MetaRow {
  value: string;
}

function readSchemaVersion(db: SqliteDb): number | null {
  const row = db.prepare('SELECT value FROM account_meta WHERE key = ?').get('schema_version') as
    | MetaRow
    | undefined;
  return row ? Number(row.value) : null;
}

function writeSchemaVersion(db: SqliteDb): void {
  db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?) ON CONFLICT DO UPDATE SET value = excluded.value').run(
    'schema_version',
    String(SCHEMA_VERSION),
  );
}

/** Runs the DDL and a `PRAGMA quick_check`; throws if the file is corrupt. */
function initAndVerify(db: SqliteDb): void {
  db.exec(INIT_ACCOUNT_SQL);
  const check = db.prepare('PRAGMA quick_check').get() as { quick_check?: string } | undefined;
  if (!check || check.quick_check !== 'ok') {
    throw new Error('file is not a database');
  }
}

function rebuildCorruptFile(
  dbPath: string,
  open: SqliteOpener,
  failedDb: SqliteDb,
  log: LogPort,
): { db: SqliteDb; binding: SqliteBinding } {
  try {
    failedDb.close();
  } catch {
    // best-effort close of an already-broken handle
  }

  if (dbPath !== ':memory:' && fs.existsSync(dbPath)) {
    const renamedTo = `${dbPath}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.renameSync(dbPath, renamedTo);
    log.error({ scope: 'storage', event: 'account.db_rebuilt', dbPath, renamedTo });
  } else {
    log.error({ scope: 'storage', event: 'account.db_rebuilt', dbPath });
  }

  const rebuilt = open(dbPath);
  initAndVerify(rebuilt.db);
  writeSchemaVersion(rebuilt.db);
  return rebuilt;
}

/**
 * Opens the account SQLite database (or `:memory:`), classifying every way it can fail into
 * one discriminated `OpenResult` (design.md §3). Never throws.
 */
export function openAccountDatabase(dbPath: string, deps: OpenAccountDatabaseDeps = {}): OpenResult {
  const open = deps.open ?? defaultSqliteOpener;
  const log = deps.log ?? NOOP_LOG_PORT;

  let opened: { db: SqliteDb; binding: SqliteBinding };
  try {
    opened = open(dbPath);
  } catch (err) {
    if (isNotWritableError(err)) {
      log.warn({ scope: 'storage', event: 'account.not_writable', dbPath });
      return { status: 'degraded', db: null, binding: null, reason: 'not_writable' };
    }
    log.error({ scope: 'storage', event: 'account.no_binding', dbPath });
    return { status: 'unavailable', db: null, binding: null, reason: 'no_sqlite_binding' };
  }

  let { db, binding } = opened;

  try {
    initAndVerify(db);
  } catch {
    try {
      ({ db, binding } = rebuildCorruptFile(dbPath, open, db, log));
    } catch {
      log.error({ scope: 'storage', event: 'account.no_binding', dbPath });
      return { status: 'unavailable', db: null, binding: null, reason: 'no_sqlite_binding' };
    }
    return { status: 'ok', db, binding, reason: 'corrupt_rebuilt' };
  }

  const found = readSchemaVersion(db);
  if (found === null) {
    writeSchemaVersion(db);
    return { status: 'ok', db, binding, reason: null };
  }

  if (found > SCHEMA_VERSION) {
    log.error({ scope: 'storage', event: 'account.schema_too_new', found, supported: SCHEMA_VERSION });
    db.close();
    return { status: 'unavailable', db: null, binding, reason: 'schema_too_new' };
  }

  // Equal or lower than SCHEMA_VERSION: open normally. No migrator exists at v1 — this branch
  // is where a future one would live.
  return { status: 'ok', db, binding, reason: null };
}
