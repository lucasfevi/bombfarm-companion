import { describe, expect, it } from 'vitest';
import type { SqliteBinding, SqliteDb } from '../storage/index.js';
import { detectAvailableBindings, openTestAccountDb, warnForUnavailableBindings } from '../storage/test-support.js';
import { createSubjectStore } from './subject-store.js';
import type { SecretBox } from './token-vault.js';

const availableBindings = detectAvailableBindings();
warnForUnavailableBindings(availableBindings);

const SUBJECT = 'user-subject-marker-0001';

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

function rows(db: SqliteDb): Array<{ key: string; value: string }> {
  return db.prepare("SELECT key, value FROM account_meta WHERE key = 'premium_subject_v1'").all() as Array<{
    key: string;
    value: string;
  }>;
}

describe.each(availableBindings)('createSubjectStore over the real account_meta table (%s)', (binding) => {
  it('round-trips the subject through a fresh store, as after a restart', () => {
    const db = openDb(binding);
    createSubjectStore(db, fakeBox()).store(SUBJECT);

    expect(createSubjectStore(db, fakeBox()).load()).toBe(SUBJECT);
  });

  it('keeps one row and replaces it on a second store', () => {
    const db = openDb(binding);
    const store = createSubjectStore(db, fakeBox());
    store.store(SUBJECT);
    store.store('user-subject-marker-0002');

    expect(rows(db)).toHaveLength(1);
    expect(store.load()).toBe('user-subject-marker-0002');
  });

  it('seals the row: the stored value does not contain the subject in the clear', () => {
    const db = openDb(binding);
    createSubjectStore(db, fakeBox()).store(SUBJECT);

    expect(rows(db)[0]?.value).not.toContain(SUBJECT);
    expect(Buffer.from(rows(db)[0]?.value ?? '', 'base64').toString('utf8')).not.toContain(SUBJECT);
  });

  it('deletes a row that fails to decrypt, and reads it as absent', () => {
    const db = openDb(binding);
    createSubjectStore(db, fakeBox()).store(SUBJECT);
    const broken = fakeBox({
      decrypt: () => {
        throw new Error('cannot decrypt');
      },
    });

    expect(createSubjectStore(db, broken).load()).toBeNull();
    expect(rows(db)).toHaveLength(0);
  });

  it('deletes a row that decrypts to something that is not a subject', () => {
    const db = openDb(binding);
    createSubjectStore(db, fakeBox({ encrypt: () => Buffer.from('{"subject":7}', 'utf8').reverse() })).store(SUBJECT);

    expect(createSubjectStore(db, fakeBox()).load()).toBeNull();
    expect(rows(db)).toHaveLength(0);
  });

  it('clears the row', () => {
    const db = openDb(binding);
    const store = createSubjectStore(db, fakeBox());
    store.store(SUBJECT);
    store.clear();

    expect(store.load()).toBeNull();
    expect(rows(db)).toHaveLength(0);
  });

  it('writes nothing and reads null while the box is unavailable', () => {
    const db = openDb(binding);
    const unavailable = fakeBox({ isAvailable: () => false });
    createSubjectStore(db, unavailable).store(SUBJECT);

    expect(rows(db)).toHaveLength(0);
    createSubjectStore(db, fakeBox()).store(SUBJECT);
    expect(createSubjectStore(db, unavailable).load()).toBeNull();
    expect(rows(db)).toHaveLength(1);
  });
});

describe('createSubjectStore without a database', () => {
  it('reads null and never throws', () => {
    const store = createSubjectStore(null, fakeBox());

    store.store(SUBJECT);
    store.clear();
    expect(store.load()).toBeNull();
  });
});
