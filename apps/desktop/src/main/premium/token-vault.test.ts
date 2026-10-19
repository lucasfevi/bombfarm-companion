import { describe, expect, it } from 'vitest';
import type { SqliteBinding, SqliteDb } from '../storage/index.js';
import { detectAvailableBindings, openTestAccountDb, warnForUnavailableBindings } from '../storage/test-support.js';
import { createTokenVault, type SecretBox, type StoredSession } from './token-vault.js';

const availableBindings = detectAvailableBindings();
warnForUnavailableBindings(availableBindings);

const SESSION_KEY = 'premium_session_v1';
const SETTINGS_VALUE = '{"schemaVersion":4,"marker":"settings-untouched"}';

const SESSION: StoredSession = {
  token: 'desktop-token-aaaaaaaa',
  expiresAt: '2027-01-01T00:00:00.000Z',
  rotateAfter: '2026-11-01T00:00:00.000Z',
};
const NEXT: StoredSession = {
  token: 'desktop-token-bbbbbbbb',
  expiresAt: '2027-02-01T00:00:00.000Z',
  rotateAfter: '2026-12-01T00:00:00.000Z',
};

function fakeBox(overrides: Partial<SecretBox> = {}): SecretBox {
  return {
    isAvailable: () => true,
    encrypt: (plain) => Buffer.from(plain, 'utf8').reverse(),
    decrypt: (cipher) => Buffer.from(cipher).reverse().toString('utf8'),
    ...overrides,
  };
}

function openDb(binding: SqliteBinding): SqliteDb {
  const { db } = openTestAccountDb(binding);
  if (db === null) throw new Error('the test database did not open');
  return db;
}

function rowValue(db: SqliteDb, key: string): string | undefined {
  const row = db.prepare('SELECT value FROM account_meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

function seedSettings(db: SqliteDb): void {
  db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run('settings_v1', SETTINGS_VALUE);
}

function throwingDb(real: SqliteDb, failOn: RegExp): SqliteDb {
  return {
    exec: (sql) => {
      real.exec(sql);
    },
    close: () => {
      real.close();
    },
    prepare: (sql) => {
      if (failOn.test(sql)) throw new Error('database is unavailable');
      return real.prepare(sql);
    },
  };
}

describe.each(availableBindings)('createTokenVault over the real account_meta table (%s)', (binding) => {
  it('stores the whole session encrypted as one record under its own row, never the plain token or dates', () => {
    const db = openDb(binding);
    const box = fakeBox();
    const vault = createTokenVault(db, box);

    expect(vault.store(SESSION)).toBe('persisted');

    const value = rowValue(db, SESSION_KEY);
    expect(value).toBeDefined();
    const cipher = Buffer.from(value ?? '', 'base64');
    expect(cipher.equals(box.encrypt(JSON.stringify(SESSION)))).toBe(true);
    for (const secret of [SESSION.token, SESSION.expiresAt, SESSION.rotateAfter]) {
      expect(value).not.toContain(secret);
      expect(cipher.toString('utf8')).not.toContain(secret);
    }
  });

  it('round-trips through a fresh vault, as after a restart', () => {
    const db = openDb(binding);
    createTokenVault(db, fakeBox()).store(SESSION);

    expect(createTokenVault(db, fakeBox()).load()).toEqual(SESSION);
  });

  it('replaces the row with a second store', () => {
    const db = openDb(binding);
    const vault = createTokenVault(db, fakeBox());
    vault.store(SESSION);
    vault.store(NEXT);

    expect(createTokenVault(db, fakeBox()).load()).toEqual(NEXT);
    const count = db.prepare('SELECT COUNT(*) AS n FROM account_meta WHERE key = ?').get(SESSION_KEY) as { n: number };
    expect(count.n).toBe(1);
  });

  it('clear deletes the row and the memory copy', () => {
    const db = openDb(binding);
    const vault = createTokenVault(db, fakeBox());
    vault.store(SESSION);

    vault.clear();

    expect(vault.load()).toBeNull();
    expect(rowValue(db, SESSION_KEY)).toBeUndefined();
    expect(createTokenVault(db, fakeBox()).load()).toBeNull();
  });

  it('loads nothing when nothing was stored', () => {
    const db = openDb(binding);
    expect(createTokenVault(db, fakeBox()).load()).toBeNull();
  });

  it('keeps the token in memory and writes nothing when encryption is unavailable', () => {
    const db = openDb(binding);
    const box = fakeBox({ isAvailable: () => false });
    const vault = createTokenVault(db, box);

    expect(vault.store(SESSION)).toBe('memory-only');

    expect(rowValue(db, SESSION_KEY)).toBeUndefined();
    expect(vault.load()).toEqual(SESSION);
    expect(createTokenVault(db, box).load()).toBeNull();
  });

  it('does not delete a stored row it cannot read while encryption is unavailable', () => {
    const db = openDb(binding);
    createTokenVault(db, fakeBox()).store(SESSION);

    expect(createTokenVault(db, fakeBox({ isAvailable: () => false })).load()).toBeNull();
    expect(rowValue(db, SESSION_KEY)).toBeDefined();
  });

  it('drops an older stored row when the new session can only be held in memory', () => {
    const db = openDb(binding);
    createTokenVault(db, fakeBox()).store(SESSION);

    const vault = createTokenVault(db, fakeBox({ isAvailable: () => false }));
    expect(vault.store(NEXT)).toBe('memory-only');

    expect(rowValue(db, SESSION_KEY)).toBeUndefined();
  });

  it('deletes a row that cannot be decrypted and loads nothing', () => {
    const db = openDb(binding);
    createTokenVault(db, fakeBox()).store(SESSION);
    const vault = createTokenVault(
      db,
      fakeBox({
        decrypt: () => {
          throw new Error('not decryptable by this user');
        },
      }),
    );

    expect(vault.load()).toBeNull();
    expect(rowValue(db, SESSION_KEY)).toBeUndefined();
  });

  it('deletes a row that decrypts to something that is not a session', () => {
    const db = openDb(binding);
    const box = fakeBox();
    for (const junk of ['not json', '[]', '{"token":"t"}', '{"token":1,"expiresAt":"a","rotateAfter":"b"}']) {
      db.prepare(
        'INSERT INTO account_meta (key, value) VALUES (?, ?) ON CONFLICT DO UPDATE SET value = excluded.value',
      ).run(SESSION_KEY, box.encrypt(junk).toString('base64'));

      expect(createTokenVault(db, box).load()).toBeNull();
      expect(rowValue(db, SESSION_KEY)).toBeUndefined();
    }
  });

  it('never touches the settings row around any operation', () => {
    const db = openDb(binding);
    seedSettings(db);
    const failing = fakeBox({
      decrypt: () => {
        throw new Error('nope');
      },
    });

    const vault = createTokenVault(db, fakeBox());
    vault.store(SESSION);
    expect(rowValue(db, 'settings_v1')).toBe(SETTINGS_VALUE);
    vault.store(NEXT);
    expect(rowValue(db, 'settings_v1')).toBe(SETTINGS_VALUE);
    createTokenVault(db, failing).load();
    expect(rowValue(db, 'settings_v1')).toBe(SETTINGS_VALUE);
    createTokenVault(db, fakeBox({ isAvailable: () => false })).store(SESSION);
    expect(rowValue(db, 'settings_v1')).toBe(SETTINGS_VALUE);
    vault.clear();
    expect(rowValue(db, 'settings_v1')).toBe(SETTINGS_VALUE);
  });

  it('never throws when the database fails on read, write or delete', () => {
    const db = openDb(binding);
    createTokenVault(db, fakeBox()).store(SESSION);

    const failsRead = createTokenVault(throwingDb(db, /SELECT/), fakeBox());
    expect(failsRead.load()).toBeNull();

    const failsWrite = createTokenVault(throwingDb(db, /INSERT/), fakeBox());
    expect(failsWrite.store(NEXT)).toBe('memory-only');
    expect(failsWrite.load()).toEqual(NEXT);

    const failsDelete = createTokenVault(throwingDb(db, /DELETE/), fakeBox());
    expect(() => {
      failsDelete.clear();
    }).not.toThrow();
  });

  it('holds the session in memory when encryption itself throws', () => {
    const db = openDb(binding);
    const vault = createTokenVault(
      db,
      fakeBox({
        encrypt: () => {
          throw new Error('keychain locked');
        },
      }),
    );

    expect(vault.store(SESSION)).toBe('memory-only');
    expect(vault.load()).toEqual(SESSION);
    expect(rowValue(db, SESSION_KEY)).toBeUndefined();
  });
});

describe('createTokenVault without a database', () => {
  it('keeps the session in memory only', () => {
    const vault = createTokenVault(null, fakeBox());

    expect(vault.store(SESSION)).toBe('memory-only');
    expect(vault.load()).toEqual(SESSION);
    vault.clear();
    expect(vault.load()).toBeNull();
  });

  it('loads nothing in a fresh vault', () => {
    expect(createTokenVault(null, fakeBox()).load()).toBeNull();
  });
});
