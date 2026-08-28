/* eslint-disable @typescript-eslint/no-require-imports -- test-only lazy binding probes, mirrors storage/index.ts's production pattern */
import type { LogPort, OpenResult, SqliteBinding, SqliteDb, SqliteOpener } from './index.js';
import { openAccountDatabase } from './index.js';

/** Probes which SQLite bindings actually work in this environment, without caching. */
export function detectAvailableBindings(): SqliteBinding[] {
  const bindings: SqliteBinding[] = [];
  try {
    const Database = require('better-sqlite3') as new (path: string) => { close(): void };
    new Database(':memory:').close();
    bindings.push('better-sqlite3');
  } catch {
    // not available in this environment
  }
  try {
    const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => { close(): void } };
    new DatabaseSync(':memory:').close();
    bindings.push('node:sqlite');
  } catch {
    // not available in this environment
  }
  return bindings;
}

const ALL_BINDINGS: SqliteBinding[] = ['better-sqlite3', 'node:sqlite'];

/** Prints a visible warning for every binding that could not be probed (Risk R-5) —
 * a skipped binding must never vanish silently from the test output. */
export function warnForUnavailableBindings(available: SqliteBinding[]): void {
  for (const binding of ALL_BINDINGS) {
    if (!available.includes(binding)) {
      console.warn(`[account-store tests] SQLite binding unavailable in this environment, skipping: ${binding}`);
    }
  }
}

function openerFor(binding: SqliteBinding): SqliteOpener {
  return (dbPath: string) => {
    if (binding === 'better-sqlite3') {
      const Database = require('better-sqlite3') as new (path: string) => SqliteDb;
      return { db: new Database(dbPath), binding: 'better-sqlite3' };
    }
    const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => SqliteDb };
    return { db: new DatabaseSync(dbPath), binding: 'node:sqlite' };
  };
}

/** Opens a fresh account database for `binding` at `dbPath` (default `:memory:`). */
export function openTestAccountDb(
  binding: SqliteBinding,
  dbPath = ':memory:',
  deps: { log?: LogPort } = {},
): OpenResult {
  return openAccountDatabase(dbPath, { open: openerFor(binding), ...deps });
}

export interface LogRecord {
  level: 'info' | 'warn' | 'error';
  record: Record<string, unknown>;
}

export function createLogSpy(): { log: LogPort; records: LogRecord[] } {
  const records: LogRecord[] = [];
  return {
    log: {
      info: (record) => records.push({ level: 'info', record }),
      warn: (record) => records.push({ level: 'warn', record }),
      error: (record) => records.push({ level: 'error', record }),
    },
    records,
  };
}

export interface RecordedSqliteCall {
  type: 'exec' | 'prepare' | 'close';
  sql?: string;
}

/** Wraps a real SqliteDb, recording every exec/prepare/close call for assertions like
 * "no transaction was opened" or "no SELECT against account_section ran". */
export function wrapWithRecording(db: SqliteDb): { db: SqliteDb; calls: RecordedSqliteCall[] } {
  const calls: RecordedSqliteCall[] = [];
  const wrapped: SqliteDb = {
    exec: (sql) => {
      calls.push({ type: 'exec', sql });
      db.exec(sql);
    },
    prepare: (sql) => {
      calls.push({ type: 'prepare', sql });
      return db.prepare(sql);
    },
    close: () => {
      calls.push({ type: 'close' });
      db.close();
    },
  };
  return { db: wrapped, calls };
}
