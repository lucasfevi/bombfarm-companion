import { describe, expect, it, vi } from 'vitest';
import type { SqliteDb, SqliteStatement } from '../storage/index.js';
import { detectAvailableBindings, openTestAccountDb, warnForUnavailableBindings } from '../storage/test-support.js';
import type { WindowLayoutDocument } from '../shell/window-layout.js';
import { WINDOW_LAYOUT_META_KEY } from '../shell/window-layout.js';
import { createWindowLayoutStore, DEFAULT_MINI_LAYOUT_VIEW } from './window-layout-store.js';

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

describe.each(availableBindings)('mini layout fields (%s)', (binding) => {
  it('reads a main-only row without throwing and restores main bounds', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    open.db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run(
      WINDOW_LAYOUT_META_KEY,
      JSON.stringify({ schemaVersion: 1, main: SAMPLE_LAYOUT.main }),
    );

    const store = createWindowLayoutStore(open.db);

    expect(() => store.read()).not.toThrow();
    expect(store.read()).toEqual(SAMPLE_LAYOUT);
    expect(store.getLayout()).toEqual(DEFAULT_MINI_LAYOUT_VIEW);
  });

  it('ignores an invalid mini object without wiping main', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    open.db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run(
      WINDOW_LAYOUT_META_KEY,
      JSON.stringify({
        schemaVersion: 1,
        main: SAMPLE_LAYOUT.main,
        mini: { width: 400, height: 300 },
      }),
    );

    const store = createWindowLayoutStore(open.db);

    expect(store.read()).toEqual(SAMPLE_LAYOUT);
    expect(store.getLayout()).toEqual(DEFAULT_MINI_LAYOUT_VIEW);
  });

  it('setLayout with every section off keeps the previous flags', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    const storedMini = {
      bounds: { displayId: 1, x: 10, y: 20, width: 360, height: 240 },
      showEarnings: true,
      showMap: true,
      showHeroes: false,
      axis: 'vertical' as const,
      wasOpen: true,
    };
    open.db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run(
      WINDOW_LAYOUT_META_KEY,
      JSON.stringify({ schemaVersion: 1, main: SAMPLE_LAYOUT.main, mini: storedMini }),
    );

    const store = createWindowLayoutStore(open.db);
    const rejected = store.setLayout({
      showEarnings: false,
      showMap: false,
      showHeroes: false,
      axis: 'horizontal',
    });

    expect(rejected).toEqual({
      showEarnings: true,
      showMap: true,
      showHeroes: false,
      axis: 'vertical',
    });
    expect(store.read()?.mini).toEqual(storedMini);
  });

  it('persists setLayout on the window-layout key, not settings_v1', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    const run = vi.fn();
    const originalPrepare = open.db.prepare.bind(open.db);
    open.db.prepare = (sql: string) => {
      const statement = originalPrepare(sql);
      return {
        ...statement,
        run: (...args: unknown[]) => {
          run(sql, ...args);
          return statement.run(...args);
        },
      } as SqliteStatement;
    };
    open.db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run(
      WINDOW_LAYOUT_META_KEY,
      JSON.stringify({ schemaVersion: 1, main: SAMPLE_LAYOUT.main }),
    );

    const store = createWindowLayoutStore(open.db);
    store.setLayout({
      showEarnings: true,
      showMap: false,
      showHeroes: true,
      axis: 'horizontal',
    });

    const keys = run.mock.calls.map((call) => call[1]);
    expect(keys).toContain(WINDOW_LAYOUT_META_KEY);
    expect(keys).not.toContain('settings_v1');
  });

  it('round-trips a valid mini section with main', () => {
    const open = openTestAccountDb(binding);
    const store = createWindowLayoutStore(open.db);
    store.write(SAMPLE_LAYOUT);
    store.setLayout({
      showEarnings: false,
      showMap: true,
      showHeroes: true,
      axis: 'horizontal',
    });

    expect(store.getLayout()).toEqual({
      showEarnings: false,
      showMap: true,
      showHeroes: true,
      axis: 'horizontal',
    });
    expect(store.read()?.main).toEqual(SAMPLE_LAYOUT.main);
    expect(store.read()?.mini?.wasOpen).toBe(false);
  });
});
