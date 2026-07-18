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

interface SqliteDatabase {
  close(): void;
  exec(sql: string): void;
}

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS storage_health (
    id INTEGER PRIMARY KEY,
    checked_at TEXT NOT NULL
  );
`;

function openWithNodeSqlite(dbPath: string): SqliteDatabase {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: new (path: string) => SqliteDatabase;
  };
  const db = new DatabaseSync(dbPath);
  db.exec(INIT_SQL);
  return db;
}

function openWithBetterSqlite3(dbPath: string): SqliteDatabase {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3') as new (path: string) => SqliteDatabase;
  const db = new Database(dbPath);
  db.exec(INIT_SQL);
  return db;
}

function tryOpenBetterSqlite3(dbPath: string): SqliteDatabase | null {
  try {
    return openWithBetterSqlite3(dbPath);
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
