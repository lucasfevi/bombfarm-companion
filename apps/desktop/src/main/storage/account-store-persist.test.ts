import { beforeAll, describe, expect, it } from 'vitest';
import type { AccountPayload, AccountSection, SectionFidelity } from '@bombfarm/contracts';
import { createAccountStore } from './account-store.js';
import type { OpenResult, SqliteDb } from './index.js';
import {
  createLogSpy,
  detectAvailableBindings,
  openTestAccountDb,
  warnForUnavailableBindings,
  wrapWithRecording,
} from './test-support.js';

const AVAILABLE_BINDINGS = detectAvailableBindings();

beforeAll(() => {
  warnForUnavailableBindings(AVAILABLE_BINDINGS);
});

const RESOLVED = (capturedAt: string): SectionFidelity => ({ status: 'resolved', capturedAt });
const STALE = (capturedAt: string): SectionFidelity => ({ status: 'stale', capturedAt });
const MISSING: SectionFidelity = { status: 'missing' };

function fullTableDump(db: SqliteDb): unknown[] {
  return db.prepare('SELECT * FROM account_section ORDER BY account_key, section').all();
}

function readRow(db: SqliteDb, section: AccountSection, key = ''): { body: string; captured_at: string } | undefined {
  return db
    .prepare('SELECT body, captured_at FROM account_section WHERE account_key = ? AND section = ?')
    .get(key, section) as { body: string; captured_at: string } | undefined;
}

function recordedOpen(open: OpenResult): { open: OpenResult; calls: ReturnType<typeof wrapWithRecording>['calls'] } {
  if (!open.db) throw new Error('expected a usable db for recording');
  const { db, calls } = wrapWithRecording(open.db);
  return { open: { ...open, db }, calls };
}

describe('createAccountStore().persist()', () => {
  it('ran against at least one SQLite binding', () => {
    expect(AVAILABLE_BINDINGS.length).toBeGreaterThan(0);
  });

  describe.each(AVAILABLE_BINDINGS.map((binding) => ({ binding })))('binding: $binding', ({ binding }) => {
    it('writes a resolved section body and capturedAt, readable in the same tick', () => {
      const open = openTestAccountDb(binding);
      const store = createAccountStore(open);

      const payload: AccountPayload = {
        account: { phase: 3 },
        fidelity: {
          account: RESOLVED('2026-08-12T00:00:00.000Z'),
          heroes: MISSING,
          skills: MISSING,
          casa: MISSING,
          items: MISSING,
        },
      };
      const result = store.persist(payload);

      expect(result.written).toEqual(['account']);
      const restored = store.restore();
      expect((restored.payload as unknown as Record<string, unknown>).account).toEqual({ phase: 3 });
      expect(restored.payload.fidelity.account).toEqual({ status: 'stale', capturedAt: '2026-08-12T00:00:00.000Z' });
      store.close();
    });

    it('stores capturedAt verbatim, including a non-UTC offset', () => {
      const open = openTestAccountDb(binding);
      const store = createAccountStore(open);
      const payload: AccountPayload = {
        account: { phase: 1 },
        fidelity: {
          account: RESOLVED('2026-08-12T00:00:00.000-03:00'),
          heroes: MISSING,
          skills: MISSING,
          casa: MISSING,
          items: MISSING,
        },
      };
      store.persist(payload);
      const restored = store.restore();
      expect(restored.payload.fidelity.account).toEqual({
        status: 'stale',
        capturedAt: '2026-08-12T00:00:00.000-03:00',
      });
      store.close();
    });

    it('writes only the resolved sections and leaves every unresolved section untouched (partial poll)', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      const store = createAccountStore(open);

      const full: AccountPayload = {
        account: { phase: 1 },
        heroes: [{ id: 'h1' }],
        skills: { totals: {} },
        casa: { active_casa: 1 },
        items: [{ id: 'i1' }],
        fidelity: {
          account: RESOLVED('2026-08-12T00:00:00.000Z'),
          heroes: RESOLVED('2026-08-12T00:00:00.000Z'),
          skills: RESOLVED('2026-08-12T00:00:00.000Z'),
          casa: RESOLVED('2026-08-12T00:00:00.000Z'),
          items: RESOLVED('2026-08-12T00:00:00.000Z'),
        },
      };
      store.persist(full);
      const skillsRowBefore = readRow(open.db, 'skills');

      const partial: AccountPayload = {
        account: { phase: 2 },
        fidelity: {
          account: RESOLVED('2026-08-12T01:00:00.000Z'),
          heroes: STALE('2026-08-12T00:00:00.000Z'),
          skills: MISSING,
          casa: STALE('2026-08-12T00:00:00.000Z'),
          items: STALE('2026-08-12T00:00:00.000Z'),
        },
      };
      const result = store.persist(partial);

      expect(result.written).toEqual(['account']);
      const skillsRowAfter = readRow(open.db, 'skills');
      expect(skillsRowAfter).toEqual(skillsRowBefore);
      store.close();
    });

    it('opens no transaction and writes nothing when no section resolved', () => {
      const raw = openTestAccountDb(binding);
      if (!raw.db) throw new Error('expected a usable db');
      raw.db
        .prepare('INSERT INTO account_section (account_key, section, body, captured_at) VALUES (?, ?, ?, ?)')
        .run('', 'account', '{"phase":1}', '2026-08-12T00:00:00.000Z');
      const before = fullTableDump(raw.db);

      const { open, calls } = recordedOpen(raw);
      const store = createAccountStore(open);
      const result = store.persist({
        fidelity: { account: STALE('x'), heroes: MISSING, skills: MISSING, casa: MISSING, items: MISSING },
      });

      expect(result.written).toEqual([]);
      expect(calls.some((c) => c.type === 'exec' && c.sql?.trim().toUpperCase() === 'BEGIN')).toBe(false);
      expect(calls.some((c) => c.type === 'prepare' && /INSERT/i.test(c.sql ?? ''))).toBe(false);
      expect(fullTableDump(raw.db)).toEqual(before);
      store.close();
    });

    it('writes nothing and logs account.no_fidelity when the payload carries no fidelity block', () => {
      const raw = openTestAccountDb(binding);
      if (!raw.db) throw new Error('expected a usable db');
      const before = fullTableDump(raw.db);
      const { log, records } = createLogSpy();
      const store = createAccountStore(raw, { log });

      const result = store.persist({ account: { phase: 1 } });

      expect(result.written).toEqual([]);
      expect(fullTableDump(raw.db)).toEqual(before);
      expect(records.some((r) => r.record.event === 'account.no_fidelity' && r.record.scope === 'storage')).toBe(
        true,
      );
      store.close();
    });

    it('rolls back the whole poll when one section fails to serialise, leaving prior rows intact', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      const store = createAccountStore(open);

      store.persist({
        account: { phase: 1 },
        fidelity: {
          account: RESOLVED('2026-08-12T00:00:00.000Z'),
          heroes: MISSING,
          skills: MISSING,
          casa: MISSING,
          items: MISSING,
        },
      });
      const beforeRow = readRow(open.db, 'account');

      const circular: Record<string, unknown> = { id: 'h1' };
      circular.self = circular;
      const { log, records } = createLogSpy();
      const storeWithLog = createAccountStore(open, { log });

      const result = storeWithLog.persist({
        account: { phase: 999 },
        heroes: [circular],
        fidelity: {
          account: RESOLVED('2026-08-12T02:00:00.000Z'),
          heroes: RESOLVED('2026-08-12T02:00:00.000Z'),
          skills: MISSING,
          casa: MISSING,
          items: MISSING,
        },
      });

      expect(result.written).toEqual([]);
      const afterRow = readRow(open.db, 'account');
      expect(afterRow).toEqual(beforeRow);
      expect(records.some((r) => r.record.event === 'account.persist_failed' && r.record.scope === 'storage')).toBe(
        true,
      );
      store.close();
    });

    it('does not persist and does not disturb the stored row for a future/unknown section status', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      const store = createAccountStore(open);

      store.persist({
        heroes: [{ id: 'h1' }],
        fidelity: {
          account: MISSING,
          heroes: RESOLVED('2026-08-12T00:00:00.000Z'),
          skills: MISSING,
          casa: MISSING,
          items: MISSING,
        },
      });
      const beforeRow = readRow(open.db, 'heroes');

      // A valid capturedAt is included deliberately: this must fail the write-gate on
      // `status`, not incidentally fail a NOT NULL bind because capturedAt is absent. A
      // gate weakened to `status !== 'missing'` would otherwise still write this row
      // successfully, and a fixture with no capturedAt would hide that (the write would
      // throw for an unrelated reason and land on the same written:[] outcome by accident).
      const degradedFidelity = { status: 'degraded', capturedAt: '2026-08-12T03:00:00.000Z' } as unknown as SectionFidelity;
      const result = store.persist({
        heroes: [{ id: 'h2-should-not-be-written' }],
        fidelity: {
          account: MISSING,
          heroes: degradedFidelity,
          skills: MISSING,
          casa: MISSING,
          items: MISSING,
        },
      });

      expect(result.written).toEqual([]);
      expect(readRow(open.db, 'heroes')).toEqual(beforeRow);
      store.close();
    });

    it('does not write a resolved section whose body is undefined', () => {
      const open = openTestAccountDb(binding);
      const store = createAccountStore(open);
      const result = store.persist({
        fidelity: {
          account: RESOLVED('2026-08-12T00:00:00.000Z'),
          heroes: MISSING,
          skills: MISSING,
          casa: MISSING,
          items: MISSING,
        },
      });
      expect(result.written).toEqual([]);
      store.close();
    });

    it('writes every resolved section in one poll and reports all of them written, in canonical order', () => {
      const open = openTestAccountDb(binding);
      const store = createAccountStore(open);
      const now = '2026-08-12T00:00:00.000Z';
      const result = store.persist({
        account: { phase: 1 },
        heroes: [{ id: 'h1' }],
        skills: { totals: {} },
        casa: { active_casa: 1 },
        items: [{ id: 'i1' }],
        fidelity: {
          account: RESOLVED(now),
          heroes: RESOLVED(now),
          skills: RESOLVED(now),
          casa: RESOLVED(now),
          items: RESOLVED(now),
        },
      });
      expect(result.written).toEqual(['account', 'heroes', 'skills', 'casa', 'items']);
      store.close();
    });

    it('a later persist overwrites an earlier resolved value for the same section', () => {
      const open = openTestAccountDb(binding);
      const store = createAccountStore(open);
      store.persist({
        account: { phase: 1 },
        fidelity: { account: RESOLVED('t1'), heroes: MISSING, skills: MISSING, casa: MISSING, items: MISSING },
      });
      store.persist({
        account: { phase: 2 },
        fidelity: { account: RESOLVED('t2'), heroes: MISSING, skills: MISSING, casa: MISSING, items: MISSING },
      });
      const restored = store.restore();
      expect((restored.payload as unknown as Record<string, unknown>).account).toEqual({ phase: 2 });
      expect(restored.payload.fidelity.account).toEqual({ status: 'stale', capturedAt: 't2' });
      store.close();
    });

    it('stores capturedAt verbatim even when the store\'s own clock could never have produced it', () => {
      const open = openTestAccountDb(binding);
      const store = createAccountStore(open);
      store.persist({
        account: { phase: 1 },
        fidelity: {
          account: RESOLVED('2099-01-01T00:00:00.000Z'),
          heroes: MISSING,
          skills: MISSING,
          casa: MISSING,
          items: MISSING,
        },
      });
      const restored = store.restore();
      expect(restored.payload.fidelity.account).toEqual({ status: 'stale', capturedAt: '2099-01-01T00:00:00.000Z' });
      store.close();
    });

    it('reports written sections in ACCOUNT_SECTIONS canonical order regardless of payload field order', () => {
      const open = openTestAccountDb(binding);
      const store = createAccountStore(open);
      const now = '2026-08-12T00:00:00.000Z';
      const result = store.persist({
        items: [{ id: 'i1' }],
        account: { phase: 1 },
        fidelity: { account: RESOLVED(now), heroes: MISSING, skills: MISSING, casa: MISSING, items: RESOLVED(now) },
      });
      expect(result.written).toEqual(['account', 'items']);
      store.close();
    });

    it('binds account_id in account_meta on a first write with an explicit accountId', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      const store = createAccountStore(open);
      store.persist(
        {
          account: { phase: 1 },
          fidelity: { account: RESOLVED('t1'), heroes: MISSING, skills: MISSING, casa: MISSING, items: MISSING },
        },
        { accountId: 'account-A' },
      );
      const metaRow = open.db.prepare('SELECT value FROM account_meta WHERE key = ?').get('account_id') as
        | { value: string }
        | undefined;
      expect(metaRow?.value).toBe('account-A');
      expect(readRow(open.db, 'account', 'account-A')?.body).toBe(JSON.stringify({ phase: 1 }));
      store.close();
    });

    it('a write under a different accountId starts a new key and leaves the old key\'s rows untouched', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      const store = createAccountStore(open);
      store.persist(
        {
          account: { phase: 1 },
          fidelity: { account: RESOLVED('t1'), heroes: MISSING, skills: MISSING, casa: MISSING, items: MISSING },
        },
        { accountId: 'account-A' },
      );
      store.persist(
        {
          account: { phase: 2 },
          fidelity: { account: RESOLVED('t2'), heroes: MISSING, skills: MISSING, casa: MISSING, items: MISSING },
        },
        { accountId: 'account-B' },
      );

      expect(readRow(open.db, 'account', 'account-A')?.body).toBe(JSON.stringify({ phase: 1 }));
      expect(readRow(open.db, 'account', 'account-B')?.body).toBe(JSON.stringify({ phase: 2 }));
      store.close();
    });

    it('a fully all-missing fidelity block is also a zero-resolve no-op', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      const before = fullTableDump(open.db);
      const store = createAccountStore(open);
      const result = store.persist({
        fidelity: { account: MISSING, heroes: MISSING, skills: MISSING, casa: MISSING, items: MISSING },
      });
      expect(result.written).toEqual([]);
      expect(fullTableDump(open.db)).toEqual(before);
      store.close();
    });

    it('a no-fidelity payload does not disturb pre-existing rows', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      const store = createAccountStore(open);
      store.persist({
        account: { phase: 1 },
        fidelity: { account: RESOLVED('t1'), heroes: MISSING, skills: MISSING, casa: MISSING, items: MISSING },
      });
      const before = fullTableDump(open.db);
      store.persist({ account: { phase: 999 } });
      expect(fullTableDump(open.db)).toEqual(before);
      store.close();
    });

    it('does nothing when the store failed to open (db is null)', () => {
      const store = createAccountStore({ status: 'unavailable', db: null, binding: null, reason: 'no_sqlite_binding' });
      const result = store.persist({
        account: { phase: 1 },
        fidelity: { account: RESOLVED('t1'), heroes: MISSING, skills: MISSING, casa: MISSING, items: MISSING },
      });
      expect(result.written).toEqual([]);
    });

    it('does nothing when the store is degraded (not writable, db is null)', () => {
      const store = createAccountStore({ status: 'degraded', db: null, binding: null, reason: 'not_writable' });
      const result = store.persist({
        account: { phase: 1 },
        fidelity: { account: RESOLVED('t1'), heroes: MISSING, skills: MISSING, casa: MISSING, items: MISSING },
      });
      expect(result.written).toEqual([]);
    });

    it('stores an empty-string capturedAt verbatim rather than treating it as absent', () => {
      const open = openTestAccountDb(binding);
      const store = createAccountStore(open);
      const result = store.persist({
        account: { phase: 1 },
        fidelity: { account: RESOLVED(''), heroes: MISSING, skills: MISSING, casa: MISSING, items: MISSING },
      });
      expect(result.written).toEqual(['account']);
      const restored = store.restore();
      expect(restored.payload.fidelity.account).toEqual({ status: 'stale', capturedAt: '' });
      store.close();
    });
  });
});
