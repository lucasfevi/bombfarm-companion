import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { SqliteDb } from '../storage/index.js';
import { SCHEMA_VERSION } from '../storage/account-schema.js';
import { detectAvailableBindings, openTestAccountDb, warnForUnavailableBindings } from '../storage/test-support.js';
import { createShellNoticeStore } from './shell-notice-store.js';

const availableBindings = detectAvailableBindings();
warnForUnavailableBindings(availableBindings);

const META_KEY = 'shell_notice_v1';
const FIXED = new Date('2026-11-02T10:00:00.000Z');

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe.each(availableBindings)('createShellNoticeStore over the real account_meta table (%s)', (binding) => {
  it('reads as not-shown before anything is written', () => {
    const open = openTestAccountDb(binding);
    expect(createShellNoticeStore(open.db).hasShown()).toBe(false);
  });

  it('markShown() then hasShown() is true, and the row is { shownAt } under shell_notice_v1', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    const store = createShellNoticeStore(open.db, () => FIXED);

    store.markShown();

    expect(store.hasShown()).toBe(true);
    const row = open.db.prepare('SELECT value FROM account_meta WHERE key = ?').get(META_KEY) as
      | { value: string }
      | undefined;
    expect(JSON.parse(row?.value ?? 'null')).toEqual({ shownAt: '2026-11-02T10:00:00.000Z' });
  });

  it('the marker survives a second store opened on the same database file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'shell-notice-'));
    tempDirs.push(dir);
    const file = join(dir, 'account.db');

    const first = openTestAccountDb(binding, file);
    createShellNoticeStore(first.db).markShown();
    first.db?.close();

    const second = openTestAccountDb(binding, file);
    expect(createShellNoticeStore(second.db).hasShown()).toBe(true);
    second.db?.close();
  });

  it('a malformed row reads as not-shown rather than throwing', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    open.db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run(META_KEY, '{not json');
    expect(createShellNoticeStore(open.db).hasShown()).toBe(false);
  });

  it('a row without a string shownAt reads as not-shown', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    open.db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run(META_KEY, '{"shownAt":5}');
    expect(createShellNoticeStore(open.db).hasShown()).toBe(false);
  });

  it('a failing write is swallowed and the notice reads as not-shown', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    const real = open.db;
    const broken: SqliteDb = {
      ...real,
      exec: real.exec.bind(real),
      close: real.close.bind(real),
      prepare: (sql: string) => {
        if (sql.startsWith('INSERT')) throw new Error('disk full');
        return real.prepare(sql);
      },
    };
    const store = createShellNoticeStore(broken);

    expect(() => {
      store.markShown();
    }).not.toThrow();
    expect(store.hasShown()).toBe(false);
  });

  it('does not move the account schema version and leaves no other rows behind', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    const before = open.db.prepare('SELECT COUNT(*) AS n FROM account_meta').get() as { n: number };
    createShellNoticeStore(open.db).markShown();
    const after = open.db.prepare('SELECT COUNT(*) AS n FROM account_meta').get() as { n: number };
    expect(after.n).toBe(before.n + 1);
    expect(SCHEMA_VERSION).toBe(1);
  });

  it('exposes only hasShown and markShown — no close, no handle', () => {
    const open = openTestAccountDb(binding);
    expect(Object.keys(createShellNoticeStore(open.db)).sort()).toEqual(['hasShown', 'markShown']);
  });
});

describe('createShellNoticeStore(null) — a db that never opened', () => {
  it('hasShown() is false and markShown() does not throw', () => {
    const store = createShellNoticeStore(null);
    expect(store.hasShown()).toBe(false);
    expect(() => {
      store.markShown();
    }).not.toThrow();
    expect(store.hasShown()).toBe(false);
  });
});
