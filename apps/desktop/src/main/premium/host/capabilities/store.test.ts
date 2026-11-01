import { describe, expect, it } from 'vitest';
import { detectAvailableBindings, openTestAccountDb, warnForUnavailableBindings } from '../../../storage/test-support.js';
import type { SqliteBinding, SqliteDb } from '../../../storage/index.js';
import { createSealedRows, type Parse, type SealedRows } from '../../licence/licence-store.js';
import type { SecretBox } from '../../token-vault.js';
import { CapabilityError } from '../capability-channel.js';
import { createStoreCapability, STORE_TOTAL_MAX_BYTES, STORE_VALUE_MAX_BYTES, storeRowKey } from './store.js';

const ALICE = 'user-alice-0001';
const BOB = 'user-bob-0002';

interface FakeRows extends SealedRows {
  readonly held: Map<string, string>;
  writes: number;
  isAvailable: boolean;
}

function fakeRows(): FakeRows {
  const held = new Map<string, string>();
  const rows: FakeRows = {
    held,
    writes: 0,
    isAvailable: true,
    available: () => rows.isAvailable,
    read<T>(key: string, parse: Parse<T>): T | null {
      const stored = held.get(key);
      return stored === undefined ? null : parse(JSON.parse(stored) as Record<string, unknown>);
    },
    write(key, json) {
      if (!rows.isAvailable) return 'unavailable';
      rows.writes += 1;
      held.set(key, json());
      return 'written';
    },
    delete(key) {
      held.delete(key);
      return true;
    },
  };
  return rows;
}

function setup(subject: string | null = ALICE) {
  const rows = fakeRows();
  const who = { current: subject };
  const call = createStoreCapability({ subject: () => who.current, rows });
  return { rows, who, call };
}

function refusal(run: () => unknown): string {
  try {
    run();
  } catch (thrown) {
    if (thrown instanceof CapabilityError) return thrown.code;
    throw thrown;
  }
  return 'none';
}

describe('the store capability', () => {
  it('reads back what was set, lists keys and forgets what was deleted', () => {
    const { call } = setup();

    call({ op: 'set', key: 'a.b-c', value: { n: [1, 2], s: 'x' } });
    call({ op: 'set', key: 'second', value: false });

    expect(call({ op: 'get', key: 'a.b-c' })).toEqual({ n: [1, 2], s: 'x' });
    expect(call({ op: 'get', key: 'second' })).toBe(false);
    expect(call({ op: 'keys' })).toEqual(['a.b-c', 'second']);

    call({ op: 'delete', key: 'second' });
    expect(call({ op: 'get', key: 'second' })).toBeNull();
    expect(call({ op: 'keys' })).toEqual(['a.b-c']);
  });

  it('overwrites on set and treats deleting a missing key as ok', () => {
    const { call } = setup();
    call({ op: 'set', key: 'k', value: 1 });
    call({ op: 'set', key: 'k', value: 2 });

    expect(call({ op: 'get', key: 'k' })).toBe(2);
    expect(call({ op: 'delete', key: 'absent' })).toBeNull();
  });

  it('does not answer an inherited name as a stored key', () => {
    const { call } = setup();

    expect(call({ op: 'get', key: 'constructor' })).toBeNull();
    expect(call({ op: 'keys' })).toEqual([]);
  });

  it('keeps the row sealed under the subject and drops it when the last key goes', () => {
    const { call, rows } = setup();
    call({ op: 'set', key: 'k', value: 1 });
    expect([...rows.held.keys()]).toEqual([storeRowKey(ALICE)]);

    call({ op: 'delete', key: 'k' });
    expect(rows.held.size).toBe(0);
  });

  it.each([
    ['an unknown op', { op: 'put', key: 'k', value: 1 }],
    ['no args', undefined],
    ['a string for args', 'get'],
    ['a missing key', { op: 'get' }],
    ['an upper-case key', { op: 'get', key: 'Key' }],
    ['a key with a space', { op: 'get', key: 'a b' }],
    ['an empty key', { op: 'get', key: '' }],
    ['a 65-character key', { op: 'get', key: 'a'.repeat(65) }],
    ['a key that is not a string', { op: 'delete', key: 7 }],
    ['a set with no value', { op: 'set', key: 'k' }],
  ])('refuses %s as bad_args and writes nothing', (_name, args) => {
    const { call, rows } = setup();

    expect(refusal(() => call(args))).toBe('bad_args');
    expect(rows.writes).toBe(0);
  });

  it('accepts a 64-character key', () => {
    const { call } = setup();

    call({ op: 'set', key: 'a'.repeat(64), value: 1 });

    expect(call({ op: 'get', key: 'a'.repeat(64) })).toBe(1);
  });

  it('takes a value of exactly 64 KiB and refuses one byte more as too_large, writing nothing', () => {
    const { call, rows } = setup();
    const fits = 'x'.repeat(STORE_VALUE_MAX_BYTES - 2);

    call({ op: 'set', key: 'edge', value: fits });
    expect(call({ op: 'get', key: 'edge' })).toBe(fits);

    const writes = rows.writes;
    expect(refusal(() => call({ op: 'set', key: 'edge', value: `${fits}x` }))).toBe('too_large');
    expect(rows.writes).toBe(writes);
    expect(call({ op: 'get', key: 'edge' })).toBe(fits);
  });

  it('takes a row of exactly 1 MiB and refuses one byte more as too_large, writing nothing', () => {
    const { call, rows } = setup();
    const chunk = 'x'.repeat(60_000);
    for (let i = 0; i < 17; i += 1) call({ op: 'set', key: `k${String(i).padStart(2, '0')}`, value: chunk });
    const held = (): string => rows.held.get(storeRowKey(ALICE)) ?? '';
    const room = STORE_TOTAL_MAX_BYTES - Buffer.byteLength(held(), 'utf8');
    const pad = room - Buffer.byteLength(',"last":""', 'utf8');
    expect(pad).toBeGreaterThan(0);
    expect(pad).toBeLessThan(STORE_VALUE_MAX_BYTES);

    call({ op: 'set', key: 'last', value: 'y'.repeat(pad) });
    expect(Buffer.byteLength(held(), 'utf8')).toBe(STORE_TOTAL_MAX_BYTES);

    const before = held();
    expect(refusal(() => call({ op: 'set', key: 'more', value: 1 }))).toBe('too_large');
    expect(refusal(() => call({ op: 'set', key: 'last', value: 'y'.repeat(pad + 1) }))).toBe('too_large');
    expect(held()).toBe(before);
  });

  it('keeps two subjects apart', () => {
    const { call, who } = setup(ALICE);
    call({ op: 'set', key: 'mine', value: 'alice' });

    who.current = BOB;
    expect(call({ op: 'get', key: 'mine' })).toBeNull();
    expect(call({ op: 'keys' })).toEqual([]);
    call({ op: 'set', key: 'mine', value: 'bob' });

    who.current = ALICE;
    expect(call({ op: 'get', key: 'mine' })).toBe('alice');
  });

  it('answers unavailable, writing nothing, with no secret box or no subject', () => {
    const { call, rows, who } = setup();
    rows.isAvailable = false;
    for (const args of [{ op: 'set', key: 'k', value: 1 }, { op: 'get', key: 'k' }, { op: 'keys' }]) {
      expect(refusal(() => call(args))).toBe('unavailable');
    }
    expect(rows.writes).toBe(0);
    expect(rows.held.size).toBe(0);

    rows.isAvailable = true;
    who.current = null;
    expect(refusal(() => call({ op: 'set', key: 'k', value: 1 }))).toBe('unavailable');
    expect(rows.held.size).toBe(0);
  });

  it('keeps every write when sets run together on one subject, and the last on a key wins', async () => {
    const { call } = setup();

    await Promise.all([
      ...Array.from({ length: 20 }, (_, i) => Promise.resolve().then(() => call({ op: 'set', key: `k${String(i)}`, value: i }))),
      Promise.resolve().then(() => call({ op: 'set', key: 'same', value: 'first' })),
      Promise.resolve().then(() => call({ op: 'set', key: 'same', value: 'last' })),
    ]);

    expect((call({ op: 'keys' }) as string[]).length).toBe(21);
    expect(call({ op: 'get', key: 'k19' })).toBe(19);
    expect(call({ op: 'get', key: 'same' })).toBe('last');
  });
});

const availableBindings = detectAvailableBindings();
warnForUnavailableBindings(availableBindings);

function fakeBox(): SecretBox {
  return {
    isAvailable: () => true,
    encrypt: (plain) => Buffer.from(plain, 'utf8').reverse(),
    decrypt: (cipher) => Buffer.from(cipher).reverse().toString('utf8'),
  };
}

function openDb(binding: SqliteBinding): SqliteDb {
  const { db } = openTestAccountDb(binding);
  if (db === null) throw new Error('the test database did not open');
  return db;
}

describe.each(availableBindings)('the store over the real sealed rows (%s)', (binding) => {
  it('reads a value back through a fresh capability on the same database, as after a restart', () => {
    const db = openDb(binding);
    const first = createStoreCapability({ subject: () => ALICE, rows: createSealedRows(db, fakeBox()) });
    first({ op: 'set', key: 'kept', value: { n: 1 } });

    const again = createStoreCapability({ subject: () => ALICE, rows: createSealedRows(db, fakeBox()) });

    expect(again({ op: 'get', key: 'kept' })).toEqual({ n: 1 });
  });

  it('deletes a corrupt row and reads it as empty', () => {
    const db = openDb(binding);
    const call = createStoreCapability({ subject: () => ALICE, rows: createSealedRows(db, fakeBox()) });
    db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run(storeRowKey(ALICE), 'bm90LWpzb24=');

    expect(call({ op: 'keys' })).toEqual([]);
    expect(db.prepare('SELECT value FROM account_meta WHERE key = ?').get(storeRowKey(ALICE))).toBeUndefined();
  });
});
