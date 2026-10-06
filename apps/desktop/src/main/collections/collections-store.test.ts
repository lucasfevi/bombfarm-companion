import { describe, expect, it } from 'vitest';
import { EMPTY_COLLECTIONS_VIEW, type AccountSource } from '@bombfarm/contracts';
import { SCHEMA_VERSION } from '../storage/account-schema.js';
import { createLogSpy } from '../storage/test-support.js';
import { createCollectionsStore, type CollectionsStore } from './collections-store.js';
import { collectionsSnapshot, openDb } from './collections-test-support.js';

const AT = { capturedAt: '2026-10-02T10:00:00.000Z' };

function storeFor(db: ReturnType<typeof openDb>, account: () => string | null, source: () => AccountSource = () => 'server') {
  return createCollectionsStore({ db, accountId: account, accountSource: source });
}

describe('collections store', () => {
  it('creates its table beside the account tables without moving the schema version', () => {
    const db = openDb();
    storeFor(db, () => '42');
    const version = db.prepare('SELECT value FROM account_meta WHERE key = ?').get('schema_version') as { value: string } | undefined;
    expect(version?.value).toBe(String(SCHEMA_VERSION));
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'collections_state'").get()).toEqual({
      name: 'collections_state',
    });
  });

  it('answers an empty view before anything was read', () => {
    expect(storeFor(openDb(), () => '42').view()).toBe(EMPTY_COLLECTIONS_VIEW);
  });

  it('round-trips the snapshot and the time it was read', () => {
    const store = storeFor(openDb(), () => '42');
    expect(store.record(collectionsSnapshot(), AT)).toBe('recorded');
    expect(store.view()).toEqual({ snapshot: collectionsSnapshot(), capturedAt: AT.capturedAt });
  });

  it('keeps the snapshot across a restart, which is a second store over the same database', () => {
    const db = openDb();
    storeFor(db, () => '42').record(collectionsSnapshot(), AT);
    expect(storeFor(db, () => '42').view().snapshot).toEqual(collectionsSnapshot());
  });

  it('replaces the held snapshot with a newer read and keeps one row per account', () => {
    const db = openDb();
    const store = storeFor(db, () => '42');
    const newer = { ...collectionsSnapshot(), partialPct: 70 };
    store.record(collectionsSnapshot(), AT);
    store.record(newer, { capturedAt: '2026-10-02T11:00:00.000Z' });
    expect(store.view()).toEqual({ snapshot: newer, capturedAt: '2026-10-02T11:00:00.000Z' });
    expect(db.prepare('SELECT COUNT(*) AS n FROM collections_state').get()).toEqual({ n: 1 });
  });

  it('never shows one account the book of another', () => {
    let account: string | null = '42';
    const store = storeFor(openDb(), () => account);
    store.record(collectionsSnapshot(), AT);

    account = '77';
    expect(store.view()).toBe(EMPTY_COLLECTIONS_VIEW);
    account = null;
    expect(store.view()).toBe(EMPTY_COLLECTIONS_VIEW);
    account = '42';
    expect(store.view().snapshot).toEqual(collectionsSnapshot());
  });

  it('keeps each account its own book when the player switches', () => {
    let account: string | null = '42';
    const store = storeFor(openDb(), () => account);
    const other = { ...collectionsSnapshot(), partialPct: 70 };
    store.record(collectionsSnapshot(), AT);
    account = '77';
    store.record(other, AT);
    expect(store.view().snapshot).toEqual(other);
    account = '42';
    expect(store.view().snapshot).toEqual(collectionsSnapshot());
  });

  it('stores a read under the account it was asked as when the bound account changed before it landed', () => {
    let account: string | null = '42';
    const store = storeFor(openDb(), () => account);
    const askedAsSecond = { ...collectionsSnapshot(), partialPct: 70 };

    expect(store.record(askedAsSecond, { ...AT, accountId: '77' })).toBe('recorded_for_other_account');
    expect(store.view()).toBe(EMPTY_COLLECTIONS_VIEW);

    account = '77';
    expect(store.view().snapshot).toEqual(askedAsSecond);
  });

  it('keeps a row written under no account from ever answering a real account', () => {
    let account: string | null = null;
    const store = storeFor(openDb(), () => account);
    expect(store.record(collectionsSnapshot(), AT)).toBe('recorded');
    expect(store.view().snapshot).toEqual(collectionsSnapshot());

    account = '42';
    expect(store.view()).toBe(EMPTY_COLLECTIONS_VIEW);
  });

  describe('in fixture mode', () => {
    it('never serves the fixture row to a real account', () => {
      const db = openDb();
      let source: AccountSource = 'fixture';
      const store = storeFor(db, () => '42', () => source);
      store.record(collectionsSnapshot(), AT);
      expect(store.view().snapshot).toEqual(collectionsSnapshot());

      source = 'server';
      expect(store.view()).toBe(EMPTY_COLLECTIONS_VIEW);
    });

    it('never serves a real account row in fixture mode, and never overwrites it', () => {
      const db = openDb();
      let source: AccountSource = 'server';
      const store = storeFor(db, () => '42', () => source);
      const real = { ...collectionsSnapshot(), partialPct: 70 };
      store.record(real, AT);

      source = 'fixture';
      expect(store.view()).toBe(EMPTY_COLLECTIONS_VIEW);
      store.record(collectionsSnapshot(), { ...AT, accountId: '42' });

      source = 'server';
      expect(store.view().snapshot).toEqual(real);
      expect(db.prepare('SELECT COUNT(*) AS n FROM collections_state').get()).toEqual({ n: 2 });
    });
  });

  it('treats a row that no longer reads as the contract shape as absent, and says so', () => {
    const db = openDb();
    const { log, records } = createLogSpy();
    const store = createCollectionsStore({ db, accountId: () => '42', accountSource: () => 'server', log });
    store.record(collectionsSnapshot(), AT);

    const damaged = { ...collectionsSnapshot(), caps: { damage: 30 } };
    db.prepare('UPDATE collections_state SET body = ? WHERE account_id = ?').run(JSON.stringify(damaged), '42');
    expect(store.view()).toBe(EMPTY_COLLECTIONS_VIEW);
    expect(records.filter((entry) => entry.level === 'warn')).toHaveLength(1);
  });

  it('treats a stored row with a figure out of range as absent', () => {
    const db = openDb();
    const store = storeFor(db, () => '42');
    store.record(collectionsSnapshot(), AT);

    const outOfRange = { ...collectionsSnapshot(), partialPct: 140 };
    db.prepare('UPDATE collections_state SET body = ? WHERE account_id = ?').run(JSON.stringify(outOfRange), '42');
    expect(store.view()).toBe(EMPTY_COLLECTIONS_VIEW);
  });

  it('treats a row that is not JSON as absent rather than throwing', () => {
    const db = openDb();
    const store = storeFor(db, () => '42');
    store.record(collectionsSnapshot(), AT);
    db.prepare('UPDATE collections_state SET body = ? WHERE account_id = ?').run('}{', '42');
    expect(store.view()).toBe(EMPTY_COLLECTIONS_VIEW);
  });

  it('holds nothing, and fails nothing, with no database behind it', () => {
    const store: CollectionsStore = createCollectionsStore({ db: null, accountId: () => '42', accountSource: () => 'server' });
    expect(store.record(collectionsSnapshot(), AT)).toBe('failed');
    expect(store.view()).toBe(EMPTY_COLLECTIONS_VIEW);
  });

  it('neither throws nor claims to have written once the database is closed', () => {
    const db = openDb();
    const { log, records } = createLogSpy();
    const store = createCollectionsStore({ db, accountId: () => '42', accountSource: () => 'server', log });
    store.record(collectionsSnapshot(), AT);
    db.close();

    expect(store.record(collectionsSnapshot(), AT)).toBe('failed');
    expect(store.view()).toBe(EMPTY_COLLECTIONS_VIEW);
    expect(records.some((entry) => entry.level === 'error')).toBe(true);
  });
});
