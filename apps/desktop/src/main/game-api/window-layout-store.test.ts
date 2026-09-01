import { describe, expect, it } from 'vitest';
import type { SqliteDb, SqliteStatement } from '../storage/index.js';
import { detectAvailableBindings, openTestAccountDb, warnForUnavailableBindings } from '../storage/test-support.js';
import type { WindowLayoutDocument } from '../shell/window-layout.js';
import { createWindowLayoutStore } from './window-layout-store.js';

const availableBindings = detectAvailableBindings();
warnForUnavailableBindings(availableBindings);

const SAMPLE_LAYOUT: WindowLayoutDocument = {
  schemaVersion: 1,
  main: {
    displayId: 1,
    x: 120,
    y: 80,
    width: 1280,
    height: 800,
    isMaximized: false,
  },
};

describe.each(availableBindings)('createWindowLayoutStore over the real account_meta table (%s)', (binding) => {
  it('read() returns null when no row has ever been written', () => {
    const open = openTestAccountDb(binding);
    const store = createWindowLayoutStore(open.db);
    expect(store.read()).toBeNull();
  });

  it('write() then read() round-trips', () => {
    const open = openTestAccountDb(binding);
    const store = createWindowLayoutStore(open.db);

    const result = store.write(SAMPLE_LAYOUT);

    expect(result).toEqual({ persisted: true });
    expect(store.read()).toEqual(SAMPLE_LAYOUT);
  });

  it('a malformed JSON value in the row falls back to null', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    open.db
      .prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)')
      .run('window_layout_v1', '{not valid json');

    const store = createWindowLayoutStore(open.db);

    expect(store.read()).toBeNull();
  });

  it('ignores extra keys such as mini while restoring main', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    open.db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run(
      'window_layout_v1',
      JSON.stringify({
        schemaVersion: 1,
        main: SAMPLE_LAYOUT.main,
        mini: { width: 400, height: 300 },
      }),
    );

    const store = createWindowLayoutStore(open.db);

    expect(store.read()).toEqual(SAMPLE_LAYOUT);
  });

  it('does not disturb a pre-existing settings_v1 row', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    const settingsValue = JSON.stringify({
      schemaVersion: 2,
      locale: 'pt-BR',
      alwaysOnTopMain: false,
      alwaysOnTopMini: false,
    });
    open.db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run('settings_v1', settingsValue);

    const store = createWindowLayoutStore(open.db);
    store.write(SAMPLE_LAYOUT);

    const row = open.db.prepare('SELECT value FROM account_meta WHERE key = ?').get('settings_v1') as
      | { value: string }
      | undefined;
    expect(row?.value).toBe(settingsValue);
  });
});

describe('createWindowLayoutStore(null) — a db that never opened', () => {
  it('read() returns null without throwing', () => {
    const store = createWindowLayoutStore(null);
    expect(store.read()).toBeNull();
  });

  it('write() reports { persisted: false }', () => {
    const store = createWindowLayoutStore(null);
    expect(store.write(SAMPLE_LAYOUT)).toEqual({ persisted: false });
  });
});

describe('createWindowLayoutStore over a db whose INSERT throws', () => {
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

  it('write() catches the throw and reports { persisted: false }', () => {
    const store = createWindowLayoutStore(throwingDb());
    expect(store.write(SAMPLE_LAYOUT)).toEqual({ persisted: false });
  });
});
