import type { PremiumMe, PremiumStatus } from '@bombfarm/contracts';
import { describe, expect, it } from 'vitest';
import type { SqliteBinding, SqliteDb } from '../storage/index.js';
import { detectAvailableBindings, openTestAccountDb, warnForUnavailableBindings } from '../storage/test-support.js';
import { createPremiumCache, type PremiumCacheEntry } from './premium-cache.js';

const availableBindings = detectAvailableBindings();
warnForUnavailableBindings(availableBindings);

const CACHE_KEY = 'premium_cache_v1';

const STATUS: PremiumStatus = {
  active: true,
  kinds: ['subscription', 'pass', 'manual_grant'],
  until: '2026-12-16T12:00:00.000Z',
  awaitingPaymentUntil: '2026-11-01T00:00:00.000Z',
  graceUntil: '2026-11-05T00:00:00.000Z',
  cancellationAt: '2026-12-16T12:00:00.000Z',
  paymentFailed: true,
  pendingFirstPayment: true,
  disputeHold: true,
};
const ME: PremiumMe = {
  methods: ['discord', 'google', 'steam'],
  steamVerified: true,
  gameAccountLinked: true,
  admitted: true,
};
const ENTRY: PremiumCacheEntry = { fetchedAt: '2026-10-17T10:00:00.000Z', status: STATUS, me: ME, visible: true };

function openDb(binding: SqliteBinding): SqliteDb {
  const { db } = openTestAccountDb(binding);
  if (db === null) throw new Error('the test database did not open');
  return db;
}

function rowValue(db: SqliteDb): string | undefined {
  const row = db.prepare('SELECT value FROM account_meta WHERE key = ?').get(CACHE_KEY) as
    | { value: string }
    | undefined;
  return row?.value;
}

function putRow(db: SqliteDb, value: string): void {
  db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?) ON CONFLICT DO UPDATE SET value = excluded.value').run(
    CACHE_KEY,
    value,
  );
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

describe.each(availableBindings)('createPremiumCache over the real account_meta table (%s)', (binding) => {
  it('round-trips a fully populated entry through a fresh cache', () => {
    const db = openDb(binding);
    createPremiumCache(db).write(ENTRY);

    expect(createPremiumCache(db).read()).toEqual(ENTRY);
  });

  it('round-trips an entry with nothing known and with no optional state', () => {
    const db = openDb(binding);
    const empty: PremiumCacheEntry = { fetchedAt: '2026-10-17T10:00:00.000Z', status: null, me: null, visible: null };
    createPremiumCache(db).write(empty);
    expect(createPremiumCache(db).read()).toEqual(empty);

    const quiet: PremiumCacheEntry = {
      fetchedAt: '2026-10-17T10:00:00.000Z',
      status: {
        active: false,
        kinds: [],
        until: null,
        awaitingPaymentUntil: null,
        graceUntil: null,
        cancellationAt: null,
        paymentFailed: false,
        pendingFirstPayment: false,
        disputeHold: false,
      },
      me: { methods: [], steamVerified: false, gameAccountLinked: false, admitted: false },
      visible: false,
    };
    createPremiumCache(db).write(quiet);
    expect(createPremiumCache(db).read()).toEqual(quiet);
  });

  it('replaces the row on each write', () => {
    const db = openDb(binding);
    const cache = createPremiumCache(db);
    cache.write(ENTRY);
    cache.write({ ...ENTRY, visible: false });

    expect(createPremiumCache(db).read()?.visible).toBe(false);
    const count = db.prepare('SELECT COUNT(*) AS n FROM account_meta WHERE key = ?').get(CACHE_KEY) as { n: number };
    expect(count.n).toBe(1);
  });

  it('stores no account id, SteamID or token on a fully populated entry', () => {
    const db = openDb(binding);
    createPremiumCache(db).write(ENTRY);

    const stored = rowValue(db) ?? '';
    expect(stored).not.toMatch(/token/i);
    expect(stored).not.toMatch(/steam_?id/i);
    expect(stored).not.toMatch(/account_?id/i);
    expect(stored).not.toMatch(/\d{17}/);
    expect(Object.keys(JSON.parse(stored) as object).sort()).toEqual(['fetchedAt', 'me', 'status', 'v', 'visible']);
  });

  it.each([
    ['malformed JSON', '{not json'],
    ['a non-object', '42'],
    ['a wrong version', JSON.stringify({ v: 2, fetchedAt: '2026-10-17T10:00:00.000Z', status: null, me: null, visible: null })],
    ['a missing fetch time', JSON.stringify({ v: 1, status: null, me: null, visible: null })],
    ['an unparsable fetch time', JSON.stringify({ v: 1, fetchedAt: 'yesterday', status: null, me: null, visible: null })],
    ['a non-boolean visible', JSON.stringify({ v: 1, fetchedAt: '2026-10-17T10:00:00.000Z', status: null, me: null, visible: 'yes' })],
    ['a status that fails its reader', JSON.stringify({ v: 1, fetchedAt: '2026-10-17T10:00:00.000Z', status: { active: 'yes' }, me: null, visible: null })],
    ['a me that fails its reader', JSON.stringify({ v: 1, fetchedAt: '2026-10-17T10:00:00.000Z', status: null, me: { v: 2 }, visible: null })],
  ])('reads null and deletes the row for %s', (_name, value) => {
    const db = openDb(binding);
    putRow(db, value);

    expect(createPremiumCache(db).read()).toBeNull();
    expect(rowValue(db)).toBeUndefined();
  });

  it('reads null when nothing was written', () => {
    const db = openDb(binding);
    expect(createPremiumCache(db).read()).toBeNull();
  });

  it('clear forgets the entry in memory and in the table', () => {
    const db = openDb(binding);
    const cache = createPremiumCache(db);
    cache.write(ENTRY);

    cache.clear();

    expect(cache.read()).toBeNull();
    expect(rowValue(db)).toBeUndefined();
    expect(createPremiumCache(db).read()).toBeNull();
  });

  it('never throws when the database fails on read, write or delete', () => {
    const db = openDb(binding);
    createPremiumCache(db).write(ENTRY);

    expect(createPremiumCache(throwingDb(db, /SELECT/)).read()).toBeNull();

    const failsWrite = createPremiumCache(throwingDb(db, /INSERT/));
    expect(() => {
      failsWrite.write({ ...ENTRY, visible: false });
    }).not.toThrow();
    expect(failsWrite.read()?.visible).toBe(false);

    const failsDelete = createPremiumCache(throwingDb(db, /DELETE/));
    expect(() => {
      failsDelete.clear();
    }).not.toThrow();
  });
});

describe('createPremiumCache without a database', () => {
  it('keeps the entry in memory only', () => {
    const cache = createPremiumCache(null);
    expect(cache.read()).toBeNull();

    cache.write(ENTRY);
    expect(cache.read()).toEqual(ENTRY);

    cache.clear();
    expect(cache.read()).toBeNull();
  });
});
