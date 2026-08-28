import { describe, expect, it } from 'vitest';
import type { AppSettings } from '@bombfarm/contracts';
import type { SqliteDb, SqliteStatement } from '../storage/index.js';
import { detectAvailableBindings, openTestAccountDb, warnForUnavailableBindings } from '../storage/test-support.js';
import { createSettingsStore } from './settings-store.js';

const availableBindings = detectAvailableBindings();
warnForUnavailableBindings(availableBindings);

const EN: AppSettings = { schemaVersion: 1, locale: 'en' };
const PT_BR: AppSettings = { schemaVersion: 1, locale: 'pt-BR' };

describe.each(availableBindings)('createSettingsStore over the real account_meta table (%s)', (binding) => {
  it('read() returns null when no row has ever been written — never a default', () => {
    const open = openTestAccountDb(binding);
    const store = createSettingsStore(open.db);
    expect(store.read()).toBeNull();
  });

  it('write() then read() round-trips', () => {
    const open = openTestAccountDb(binding);
    const store = createSettingsStore(open.db);

    const result = store.write(PT_BR);

    expect(result).toEqual({ settings: PT_BR, persisted: true, reason: null });
    expect(store.read()).toEqual(PT_BR);
  });

  it('a later write() overwrites the earlier one — one row, not an accumulating history', () => {
    const open = openTestAccountDb(binding);
    const store = createSettingsStore(open.db);
    store.write(PT_BR);
    store.write(EN);

    expect(store.read()).toEqual(EN);
  });

  it('a malformed JSON value in the row falls back to null — the safe direction (OS detection runs)', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    open.db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run('settings_v1', '{not valid json');

    const store = createSettingsStore(open.db);

    expect(store.read()).toBeNull();
  });

  it('a structurally wrong value (bad locale) falls back to null', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    open.db
      .prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)')
      .run('settings_v1', JSON.stringify({ schemaVersion: 1, locale: 'pt' }));

    const store = createSettingsStore(open.db);

    expect(store.read()).toBeNull();
  });

  it('a wrong schemaVersion falls back to null', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    open.db
      .prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)')
      .run('settings_v1', JSON.stringify({ schemaVersion: 2, locale: 'en' }));

    const store = createSettingsStore(open.db);

    expect(store.read()).toBeNull();
  });

  it('does not disturb other account_meta rows (e.g. consent_v1)', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    open.db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run('consent_v1', '{"decision":"unasked","textVersion":1}');

    const store = createSettingsStore(open.db);
    store.write(PT_BR);

    const row = open.db.prepare('SELECT value FROM account_meta WHERE key = ?').get('consent_v1') as
      | { value: string }
      | undefined;
    expect(row?.value).toBe('{"decision":"unasked","textVersion":1}');
  });
});

describe('createSettingsStore(null) — a db that never opened', () => {
  it('read() returns null without throwing', () => {
    const store = createSettingsStore(null);
    expect(store.read()).toBeNull();
  });

  it("write() reports { persisted: false, reason: 'no_store' } WITH the applied settings — never swallowed", () => {
    const store = createSettingsStore(null);
    let result: ReturnType<typeof store.write> | undefined;
    expect(() => {
      result = store.write(PT_BR);
    }).not.toThrow();
    expect(result).toEqual({ settings: PT_BR, persisted: false, reason: 'no_store' });
  });
});

describe('createSettingsStore over a db whose INSERT throws', () => {
  /** A minimal fake `SqliteDb` whose `run()` throws — simulates a read-only volume or a locked
   *  db, independent of which real SQLite binding is available in this environment. */
  function throwingDb(): SqliteDb {
    const statement: SqliteStatement = {
      run: () => {
        throw new Error('SQLITE_READONLY: attempt to write a readonly database');
      },
      get: () => undefined,
      all: () => [],
    };
    return {
      exec: () => undefined,
      prepare: () => statement,
      close: () => undefined,
    };
  }

  it("write() catches the throw and reports { persisted: false, reason: 'not_writable' } WITH the applied settings", () => {
    const store = createSettingsStore(throwingDb());

    const result = store.write(EN);

    expect(result).toEqual({ settings: EN, persisted: false, reason: 'not_writable' });
  });

  it('demonstrates the red state (recorded here, never left in settings-store.ts): swallowing the failure like consent-store.ts would lose the failure-surfaced signal', () => {
    // The rejected shape — write() swallowing the throw and returning void, exactly like
    // consent-store.ts's write(). If settings-store.ts were written this way, the caller could
    // never distinguish "persisted" from "not persisted", and the failure-surfaced Banner would never render.
    function swallowingWrite(db: SqliteDb, settings: AppSettings): void {
      try {
        db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run('settings_v1', JSON.stringify(settings));
      } catch {
        // swallowed — the rejected shape
      }
    }
    // `swallowingWrite` returns void — there is nothing to assert a `persisted`/`reason` field
    // on. That absence IS the defect: the caller has no way to know the write failed. The real
    // settings-store.ts (above) is not written this way; it returns SettingsWriteResult instead.
    expect(() => {
      swallowingWrite(throwingDb(), EN);
    }).not.toThrow();
  });
});
