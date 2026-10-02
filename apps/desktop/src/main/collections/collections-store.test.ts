import { describe, expect, it } from 'vitest';
import { EMPTY_COLLECTIONS_VIEW } from '@bombfarm/contracts';
import { SCHEMA_VERSION } from '../storage/account-schema.js';
import { createLogSpy } from '../storage/test-support.js';
import { createCollectionsStore } from './collections-store.js';
import { collectionsSnapshot, openDb } from './collections-test-support.js';

const AT = { capturedAt: '2026-10-02T10:00:00.000Z' };

describe('collections store', () => {
  it('creates its table beside the account tables without moving the schema version', () => {
    const db = openDb();
    createCollectionsStore({ db, accountId: () => '486' });
    const version = db.prepare('SELECT value FROM account_meta WHERE key = ?').get('schema_version') as { value: string } | undefined;
    expect(version?.value).toBe(String(SCHEMA_VERSION));
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'collections_state'").get()).toEqual({
      name: 'collections_state',
    });
  });

  it('answers an empty view before anything was read', () => {
    const store = createCollectionsStore({ db: openDb(), accountId: () => '486' });
    expect(store.view()).toBe(EMPTY_COLLECTIONS_VIEW);
  });

  it('round-trips the snapshot and the time it was read', () => {
    const store = createCollectionsStore({ db: openDb(), accountId: () => '486' });
    expect(store.record(collectionsSnapshot(), AT)).toBe(true);
    expect(store.view()).toEqual({ snapshot: collectionsSnapshot(), capturedAt: AT.capturedAt });
  });

  it('keeps the snapshot across a restart, which is a second store over the same database', () => {
    const db = openDb();
    createCollectionsStore({ db, accountId: () => '486' }).record(collectionsSnapshot(), AT);
    expect(createCollectionsStore({ db, accountId: () => '486' }).view().snapshot).toEqual(collectionsSnapshot());
  });

  it('replaces the held snapshot with a newer read and keeps one row per account', () => {
    const db = openDb();
    const store = createCollectionsStore({ db, accountId: () => '486' });
    const newer = { ...collectionsSnapshot(), partialPct: 70 };
    store.record(collectionsSnapshot(), AT);
    store.record(newer, { capturedAt: '2026-10-02T11:00:00.000Z' });
    expect(store.view()).toEqual({ snapshot: newer, capturedAt: '2026-10-02T11:00:00.000Z' });
    expect(db.prepare('SELECT COUNT(*) AS n FROM collections_state').get()).toEqual({ n: 1 });
  });

  it('never shows one account the book of another', () => {
    const db = openDb();
    let account: string | null = '486';
    const store = createCollectionsStore({ db, accountId: () => account });
    store.record(collectionsSnapshot(), AT);

    account = '11882';
    expect(store.view()).toBe(EMPTY_COLLECTIONS_VIEW);
    account = null;
    expect(store.view()).toBe(EMPTY_COLLECTIONS_VIEW);
    account = '486';
    expect(store.view().snapshot).toEqual(collectionsSnapshot());
  });

  it('keeps each account its own book when the player switches', () => {
    const db = openDb();
    let account: string | null = '486';
    const store = createCollectionsStore({ db, accountId: () => account });
    const other = { ...collectionsSnapshot(), partialPct: 70 };
    store.record(collectionsSnapshot(), AT);
    account = '11882';
    store.record(other, AT);
    expect(store.view().snapshot).toEqual(other);
    account = '486';
    expect(store.view().snapshot).toEqual(collectionsSnapshot());
  });

  it('treats a row that no longer reads as the contract shape as absent, and says so', () => {
    const db = openDb();
    const { log, records } = createLogSpy();
    const store = createCollectionsStore({ db, accountId: () => '486', log });
    store.record(collectionsSnapshot(), AT);

    const damaged = { ...collectionsSnapshot(), caps: { damage: 30 } };
    db.prepare('UPDATE collections_state SET body = ? WHERE account_id = ?').run(JSON.stringify(damaged), '486');
    expect(store.view()).toBe(EMPTY_COLLECTIONS_VIEW);
    expect(records.filter((entry) => entry.level === 'warn')).toHaveLength(1);
  });

  it('treats a row that is not JSON as absent rather than throwing', () => {
    const db = openDb();
    const store = createCollectionsStore({ db, accountId: () => '486' });
    store.record(collectionsSnapshot(), AT);
    db.prepare('UPDATE collections_state SET body = ? WHERE account_id = ?').run('}{', '486');
    expect(store.view()).toBe(EMPTY_COLLECTIONS_VIEW);
  });

  it('holds nothing, and fails nothing, with no database behind it', () => {
    const store = createCollectionsStore({ db: null, accountId: () => '486' });
    expect(store.record(collectionsSnapshot(), AT)).toBe(false);
    expect(store.view()).toBe(EMPTY_COLLECTIONS_VIEW);
  });
});
