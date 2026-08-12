import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SqliteBinding, SqliteDb, SqliteOpener } from './index.js';
import { openAccountDatabase } from './index.js';

function tempDbPath(): { dir: string; file: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-account-db-'));
  return { dir, file: path.join(dir, 'account.db') };
}

function realNodeSqliteOpener(dbPath: string): { db: SqliteDb; binding: SqliteBinding } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (p: string) => SqliteDb };
  return { db: new DatabaseSync(dbPath), binding: 'node:sqlite' };
}

/** Wraps a real opener, recording every SQL string passed to `prepare()`. */
function withRecording(real: SqliteOpener): { open: SqliteOpener; preparedSql: string[] } {
  const preparedSql: string[] = [];
  const open: SqliteOpener = (dbPath) => {
    const { db, binding } = real(dbPath);
    const wrapped: SqliteDb = {
      exec: (sql) => {
        db.exec(sql);
      },
      prepare: (sql) => {
        preparedSql.push(sql);
        return db.prepare(sql);
      },
      close: () => {
        db.close();
      },
    };
    return { db: wrapped, binding };
  };
  return { open, preparedSql };
}

function createLogSpy(): { log: { info: (r: Record<string, unknown>) => void; warn: (r: Record<string, unknown>) => void; error: (r: Record<string, unknown>) => void }; records: { level: string; record: Record<string, unknown> }[] } {
  const records: { level: string; record: Record<string, unknown> }[] = [];
  return {
    log: {
      info: (record) => records.push({ level: 'info', record }),
      warn: (record) => records.push({ level: 'warn', record }),
      error: (record) => records.push({ level: 'error', record }),
    },
    records,
  };
}

/** Seeds a real account DB with a schema_version and a section row using raw node:sqlite. */
function seedRawAccountDb(dbPath: string, schemaVersion: number): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (p: string) => SqliteDb };
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS account_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS account_section (
      account_key TEXT NOT NULL DEFAULT '',
      section TEXT NOT NULL,
      body TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      PRIMARY KEY (account_key, section)
    );
  `);
  db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run('schema_version', String(schemaVersion));
  db.prepare('INSERT INTO account_section (account_key, section, body, captured_at) VALUES (?, ?, ?, ?)').run(
    '',
    'account',
    '{"phase":1}',
    '2026-08-12T00:00:00.000Z',
  );
  db.close();
}

describe('openAccountDatabase', () => {
  it('opens a healthy or absent file with status ok and no reason', () => {
    const { dir, file } = tempDbPath();
    try {
      const result = openAccountDatabase(file);
      expect(result.status).toBe('ok');
      expect(result.reason).toBeNull();
      expect(result.db).not.toBeNull();
      result.db?.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes schema_version as 1 on a fresh database', () => {
    const { dir, file } = tempDbPath();
    try {
      const result = openAccountDatabase(file);
      const row = result.db?.prepare('SELECT value FROM account_meta WHERE key = ?').get('schema_version') as
        | { value: string }
        | undefined;
      expect(row?.value).toBe('1');
      result.db?.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('opens normally when schema_version equals the supported version', () => {
    const { dir, file } = tempDbPath();
    try {
      seedRawAccountDb(file, 1);
      const result = openAccountDatabase(file);
      expect(result.status).toBe('ok');
      expect(result.reason).toBeNull();
      expect(result.db).not.toBeNull();
      result.db?.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('opens normally when schema_version is lower than the supported version (no migrator at v1)', () => {
    const { dir, file } = tempDbPath();
    try {
      seedRawAccountDb(file, 0);
      const result = openAccountDatabase(file);
      expect(result.status).toBe('ok');
      expect(result.reason).toBeNull();
      result.db?.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses a future schema_version without reading a row, closing the connection', () => {
    const { dir, file } = tempDbPath();
    try {
      seedRawAccountDb(file, 99);
      const { open, preparedSql } = withRecording(realNodeSqliteOpener);
      const { log, records } = createLogSpy();

      const result = openAccountDatabase(file, { open, log });

      expect(result.status).toBe('unavailable');
      expect(result.reason).toBe('schema_too_new');
      expect(result.db).toBeNull();
      expect(preparedSql.some((sql) => /account_section/i.test(sql) && /select/i.test(sql))).toBe(false);
      expect(records.some((r) => r.record.event === 'account.schema_too_new')).toBe(true);
      expect(records.every((r) => r.record.scope === 'storage')).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('renames a corrupt file aside, rebuilds empty and reports unavailable for the account', () => {
    const { dir, file } = tempDbPath();
    try {
      fs.writeFileSync(file, Buffer.from('this is not a sqlite file, just garbage bytes'));
      const { log, records } = createLogSpy();

      const result = openAccountDatabase(file, { log });

      expect(result.status).toBe('ok');
      expect(result.reason).toBe('corrupt_rebuilt');
      expect(result.db).not.toBeNull();
      result.db?.close();

      const entries = fs.readdirSync(dir);
      expect(entries).toContain('account.db');
      expect(entries.some((name) => name.startsWith('account.db.corrupt-'))).toBe(true);
      expect(entries).toHaveLength(2);
      expect(records.some((r) => r.record.event === 'account.db_rebuilt')).toBe(true);
      expect(records.every((r) => r.record.scope === 'storage')).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  for (const code of ['EACCES', 'EPERM', 'SQLITE_CANTOPEN']) {
    it(`reports degraded and disables persistence when the opener throws ${code}`, () => {
      const notWritable: SqliteOpener = () => {
        const err = new Error(`${code}: permission denied`) as Error & { code: string };
        err.code = code;
        throw err;
      };
      const { log, records } = createLogSpy();

      const result = openAccountDatabase('/does/not/matter.db', { open: notWritable, log });

      expect(result.status).toBe('degraded');
      expect(result.reason).toBe('not_writable');
      expect(result.db).toBeNull();
      expect(result.binding).toBeNull();
      expect(records.some((r) => r.record.event === 'account.not_writable')).toBe(true);
      expect(records.every((r) => r.record.scope === 'storage')).toBe(true);
    });
  }

  it('reports which binding opened a healthy database', () => {
    const { dir, file } = tempDbPath();
    try {
      const result = openAccountDatabase(file);
      expect(['node:sqlite', 'better-sqlite3']).toContain(result.binding);
      result.db?.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reopening the same healthy file twice is idempotent (schema_version stays 1)', () => {
    const { dir, file } = tempDbPath();
    try {
      openAccountDatabase(file).db?.close();
      openAccountDatabase(file).db?.close();
      const third = openAccountDatabase(file);
      const row = third.db?.prepare('SELECT value FROM account_meta WHERE key = ?').get('schema_version') as
        | { value: string }
        | undefined;
      expect(row?.value).toBe('1');
      expect(third.status).toBe('ok');
      third.db?.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the rebuilt database after a corrupt file is actually usable for reads and writes', () => {
    const { dir, file } = tempDbPath();
    try {
      fs.writeFileSync(file, Buffer.from('garbage, not a sqlite file'));
      const result = openAccountDatabase(file);
      expect(result.db).not.toBeNull();

      result.db?.prepare('INSERT INTO account_section (account_key, section, body, captured_at) VALUES (?, ?, ?, ?)').run(
        '',
        'account',
        '{"phase":1}',
        '2026-08-12T00:00:00.000Z',
      );
      const row = result.db
        ?.prepare('SELECT body FROM account_section WHERE section = ?')
        .get('account') as { body: string } | undefined;
      expect(row?.body).toBe('{"phase":1}');

      const schemaRow = result.db?.prepare('SELECT value FROM account_meta WHERE key = ?').get('schema_version') as
        | { value: string }
        | undefined;
      expect(schemaRow?.value).toBe('1');
      result.db?.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports no_sqlite_binding when neither binding loads', () => {
    const noBinding: SqliteOpener = () => {
      throw new Error('Cannot find module better-sqlite3 or node:sqlite');
    };
    const { log, records } = createLogSpy();

    const result = openAccountDatabase('/does/not/matter.db', { open: noBinding, log });

    expect(result.status).toBe('unavailable');
    expect(result.reason).toBe('no_sqlite_binding');
    expect(result.db).toBeNull();
    expect(result.binding).toBeNull();
    expect(records.some((r) => r.record.event === 'account.no_binding')).toBe(true);
    expect(records.every((r) => r.record.scope === 'storage')).toBe(true);
  });

  it('uses a no-op log port by default without throwing', () => {
    const { dir, file } = tempDbPath();
    try {
      let result: ReturnType<typeof openAccountDatabase> | undefined;
      expect(() => {
        result = openAccountDatabase(file);
      }).not.toThrow();
      result?.db?.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
