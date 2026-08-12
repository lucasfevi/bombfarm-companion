import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { AccountPayload, AccountSection } from '@bombfarm/contracts';
import { createAccountStore } from './account-store.js';
import type { SqliteDb } from './index.js';
import {
  createLogSpy,
  detectAvailableBindings,
  openTestAccountDb,
  warnForUnavailableBindings,
} from './test-support.js';

function seedSectionRow(db: SqliteDb, key: string, section: AccountSection, body: unknown, capturedAt: string): void {
  db.prepare(
    'INSERT INTO account_section (account_key, section, body, captured_at) VALUES (?, ?, ?, ?)',
  ).run(key, section, JSON.stringify(body), capturedAt);
}

function sectionField(payload: AccountPayload, section: AccountSection): unknown {
  return (payload as unknown as Record<string, unknown>)[section];
}

function seedBoundAccountId(db: SqliteDb, key: string): void {
  db.prepare(
    'INSERT INTO account_meta (key, value) VALUES (?, ?) ON CONFLICT DO UPDATE SET value = excluded.value',
  ).run('account_id', key);
}

const AVAILABLE_BINDINGS = detectAvailableBindings();

beforeAll(() => {
  warnForUnavailableBindings(AVAILABLE_BINDINGS);
});

describe('createAccountStore().restore()', () => {
  it('ran against at least one SQLite binding', () => {
    expect(AVAILABLE_BINDINGS.length).toBeGreaterThan(0);
  });

  describe.each(AVAILABLE_BINDINGS.map((binding) => ({ binding })))('binding: $binding', ({ binding }) => {
    it('reports unavailable with an empty payload when nothing was ever stored', () => {
      const open = openTestAccountDb(binding);
      const store = createAccountStore(open);
      const restored = store.restore();

      expect(restored.status).toBe('unavailable');
      expect(restored.reason).toBe('empty');
      expect(restored.gameRunning).toBe(false);
      for (const section of ['account', 'heroes', 'skills', 'casa', 'items'] as AccountSection[]) {
        expect(restored.payload.fidelity[section]).toEqual({ status: 'missing' });
        expect(sectionField(restored.payload, section)).toBeUndefined();
        expect(sectionField(restored.payload, section)).not.toEqual({});
        expect(sectionField(restored.payload, section)).not.toEqual([]);
        expect(sectionField(restored.payload, section)).not.toBe(0);
        expect(sectionField(restored.payload, section)).not.toBeNull();
      }
      store.close();
    });

    it('serves a cold-start restore as not running with every stored section stale', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      seedSectionRow(open.db, '', 'account', { phase: 5 }, '2026-08-12T00:00:00.000Z');
      seedSectionRow(open.db, '', 'heroes', [{ id: 'h1' }], '2026-08-12T00:00:01.000Z');

      const store = createAccountStore(open);
      const restored = store.restore();

      expect(restored.gameRunning).toBe(false);
      expect(restored.payload.fidelity.account).toEqual({ status: 'stale', capturedAt: '2026-08-12T00:00:00.000Z' });
      expect(restored.payload.fidelity.heroes).toEqual({ status: 'stale', capturedAt: '2026-08-12T00:00:01.000Z' });
      for (const section of Object.values(restored.payload.fidelity)) {
        expect(section.status).not.toBe('resolved');
      }
      store.close();
    });

    it('round-trips every section unchanged across a close/reopen, including adversarial bodies', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-account-store-'));
      const dbPath = path.join(dir, 'account.db');
      try {
        const bodies: Record<AccountSection, unknown> = {
          account: { phase: 123456789012345, note: 'ünïcödé — 日本語 — 0', empty: '' },
          heroes: [{ id: 'h1', nested: [[1, 2], [3, { deep: true }]] }],
          skills: { totals: {}, zero: 0 },
          casa: { active_casa: 0, levels: [] },
          items: [{ id: 'i1', stats: [{ stat: 1, value: 0, effective: 0 }] }],
        };
        const capturedAt: Record<AccountSection, string> = {
          account: '2026-08-12T00:00:00.000Z',
          heroes: '2026-08-12T00:00:01.000Z',
          skills: '2026-08-12T00:00:02.000Z',
          casa: '2026-08-12T00:00:03.000Z',
          items: '2026-08-12T00:00:04.000Z',
        };

        const first = openTestAccountDb(binding, dbPath);
        if (!first.db) throw new Error('expected a usable db');
        for (const section of ['account', 'heroes', 'skills', 'casa', 'items'] as AccountSection[]) {
          seedSectionRow(first.db, '', section, bodies[section], capturedAt[section]);
        }
        createAccountStore(first).close();

        const second = openTestAccountDb(binding, dbPath);
        const store = createAccountStore(second);
        const restored = store.restore();

        for (const section of ['account', 'heroes', 'skills', 'casa', 'items'] as AccountSection[]) {
          expect(sectionField(restored.payload, section)).toEqual(bodies[section]);
          expect(restored.payload.fidelity[section]).toEqual({ status: 'stale', capturedAt: capturedAt[section] });
        }
        store.close();
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('serves two sections with the two timestamps they were written with, no account-level capture time', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      seedSectionRow(open.db, '', 'account', { phase: 1 }, '2026-08-01T00:00:00.000Z');
      seedSectionRow(open.db, '', 'skills', { totals: {} }, '2026-08-05T12:30:00.000Z');

      const store = createAccountStore(open);
      const restored = store.restore();

      expect(restored.payload.fidelity.account).toEqual({ status: 'stale', capturedAt: '2026-08-01T00:00:00.000Z' });
      expect(restored.payload.fidelity.skills).toEqual({ status: 'stale', capturedAt: '2026-08-05T12:30:00.000Z' });
      expect(restored).not.toHaveProperty('capturedAt');
      expect(restored.payload).not.toHaveProperty('capturedAt');
      store.close();
    });

    it('discards an undecodable row, logs it, and reports the section missing', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      open.db.prepare(
        'INSERT INTO account_section (account_key, section, body, captured_at) VALUES (?, ?, ?, ?)',
      ).run('', 'skills', 'not even json{{{', '2026-08-12T00:00:00.000Z');
      seedSectionRow(open.db, '', 'account', { phase: 1 }, '2026-08-12T00:00:00.000Z');

      const { log, records } = createLogSpy();
      const store = createAccountStore(open, { log });
      const restored = store.restore();

      expect(restored.payload.fidelity.skills).toEqual({ status: 'missing' });
      expect(sectionField(restored.payload, 'skills')).toBeUndefined();
      expect(restored.payload.fidelity.account).toEqual({ status: 'stale', capturedAt: '2026-08-12T00:00:00.000Z' });
      expect(
        records.some(
          (r) => r.record.event === 'account.row_discarded' && r.record.section === 'skills' && r.record.scope === 'storage',
        ),
      ).toBe(true);
      store.close();
    });

    it('performs no normalization of its own — bodies round-trip byte-equal', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      const body = { z: 1, a: 2, unfamiliarFutureField: 'kept', m: 3 };
      seedSectionRow(open.db, '', 'account', body, '2026-08-12T00:00:00.000Z');

      const store = createAccountStore(open);
      const restored = store.restore();

      expect(Object.keys(sectionField(restored.payload, 'account') as object)).toEqual([
        'z',
        'a',
        'unfamiliarFutureField',
        'm',
      ]);
      expect(sectionField(restored.payload, 'account')).toEqual(body);
      store.close();
    });

    it('serves every section missing when a different account is running, without touching the other key\'s rows', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      seedBoundAccountId(open.db, 'account-A');
      seedSectionRow(open.db, 'account-A', 'account', { phase: 1 }, '2026-08-12T00:00:00.000Z');

      const store = createAccountStore(open);
      const restored = store.restore('account-B');

      expect(restored.status).toBe('unavailable');
      expect(restored.reason).toBe('account_mismatch');
      for (const section of ['account', 'heroes', 'skills', 'casa', 'items'] as AccountSection[]) {
        expect(restored.payload.fidelity[section]).toEqual({ status: 'missing' });
      }

      const stillThere = open.db
        .prepare('SELECT body FROM account_section WHERE account_key = ? AND section = ?')
        .get('account-A', 'account') as { body: string } | undefined;
      expect(stillThere?.body).toBe(JSON.stringify({ phase: 1 }));
      store.close();
    });

    it('gameRunning is false on every restore path', () => {
      const empty = createAccountStore(openTestAccountDb(binding));
      expect(empty.restore().gameRunning).toBe(false);
      empty.close();
    });

    it('reports status ok with a null reason when at least one section resolved something to restore', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      seedSectionRow(open.db, '', 'account', { phase: 1 }, '2026-08-12T00:00:00.000Z');
      const store = createAccountStore(open);
      const restored = store.restore();
      expect(restored.status).toBe('ok');
      expect(restored.reason).toBeNull();
      store.close();
    });

    it('restore() is idempotent — two calls in a row return deep-equal results', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      seedSectionRow(open.db, '', 'account', { phase: 1 }, '2026-08-12T00:00:00.000Z');
      const store = createAccountStore(open);
      expect(store.restore()).toEqual(store.restore());
      store.close();
    });

    it('adversarial body: unicode text round-trips exactly', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      const body = { name: 'ünïcödé — 日本語 — emoji 🎉' };
      seedSectionRow(open.db, '', 'account', body, '2026-08-12T00:00:00.000Z');
      const store = createAccountStore(open);
      expect(sectionField(store.restore().payload, 'account')).toEqual(body);
      store.close();
    });

    it('adversarial body: deeply nested arrays round-trip exactly', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      const body = [{ nested: [[1, 2], [3, [4, [5, { deep: true }]]]] }];
      seedSectionRow(open.db, '', 'items', body, '2026-08-12T00:00:00.000Z');
      const store = createAccountStore(open);
      expect(sectionField(store.restore().payload, 'items')).toEqual(body);
      store.close();
    });

    it('adversarial body: a zero-valued field round-trips as 0, not as absent or falsy-stripped', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      const body = { gold: 0, totals: {} };
      seedSectionRow(open.db, '', 'skills', body, '2026-08-12T00:00:00.000Z');
      const store = createAccountStore(open);
      const restoredBody = sectionField(store.restore().payload, 'skills') as { gold: number };
      expect(restoredBody.gold).toBe(0);
      store.close();
    });

    it('adversarial body: an empty-string field round-trips as "", not as absent or null', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      const body = { active_casa: '', levels: [] };
      seedSectionRow(open.db, '', 'casa', body, '2026-08-12T00:00:00.000Z');
      const store = createAccountStore(open);
      const restoredBody = sectionField(store.restore().payload, 'casa') as { active_casa: string };
      expect(restoredBody.active_casa).toBe('');
      store.close();
    });

    it('adversarial body: a 15-digit integer round-trips without precision loss', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      const body = { phase: 123456789012345 };
      seedSectionRow(open.db, '', 'account', body, '2026-08-12T00:00:00.000Z');
      const store = createAccountStore(open);
      const restoredBody = sectionField(store.restore().payload, 'account') as { phase: number };
      expect(restoredBody.phase).toBe(123456789012345);
      store.close();
    });

    it('capturedAt with a non-UTC offset round-trips as the exact same string, never reformatted', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      seedSectionRow(open.db, '', 'account', { phase: 1 }, '2026-08-12T00:00:00.000-03:00');
      const store = createAccountStore(open);
      const restored = store.restore();
      expect(restored.payload.fidelity.account).toEqual({ status: 'stale', capturedAt: '2026-08-12T00:00:00.000-03:00' });
      store.close();
    });

    it('a first bind to a never-before-seen account id reads its own (empty) rows, not the default key\'s', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      // Data exists under the unbound default key, but the store has never bound any account yet.
      seedSectionRow(open.db, '', 'account', { phase: 1 }, '2026-08-12T00:00:00.000Z');
      const store = createAccountStore(open);
      const restored = store.restore('brand-new-account');
      expect(restored.status).toBe('unavailable');
      expect(restored.reason).toBe('empty');
      store.close();
    });

    it('restore(expectedAccountId) reads the real bound key\'s rows when it matches the binding', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      seedBoundAccountId(open.db, 'account-A');
      seedSectionRow(open.db, 'account-A', 'account', { phase: 7 }, '2026-08-12T00:00:00.000Z');
      const store = createAccountStore(open);
      const restored = store.restore('account-A');
      expect(restored.status).toBe('ok');
      expect(sectionField(restored.payload, 'account')).toEqual({ phase: 7 });
      store.close();
    });

    it('discards a wrong-container row (valid JSON, wrong shape) distinctly from invalid JSON', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      // heroes must be an array; a plain object is valid JSON but the wrong container.
      open.db
        .prepare('INSERT INTO account_section (account_key, section, body, captured_at) VALUES (?, ?, ?, ?)')
        .run('', 'heroes', '{"not":"an array"}', '2026-08-12T00:00:00.000Z');

      const { log, records } = createLogSpy();
      const store = createAccountStore(open, { log });
      const restored = store.restore();

      expect(restored.payload.fidelity.heroes).toEqual({ status: 'missing' });
      expect(
        records.some(
          (r) => r.record.event === 'account.row_discarded' && r.record.section === 'heroes' && r.record.reason === 'wrong_container',
        ),
      ).toBe(true);
      store.close();
    });
  });

  it('propagates schema_too_new from openAccountDatabase with an empty payload', () => {
    const store = createAccountStore({ status: 'unavailable', db: null, binding: null, reason: 'schema_too_new' });
    const restored = store.restore();
    expect(restored.status).toBe('unavailable');
    expect(restored.reason).toBe('schema_too_new');
    for (const section of Object.values(restored.payload.fidelity)) {
      expect(section.status).toBe('missing');
    }
  });

  it('propagates no_sqlite_binding from openAccountDatabase with an empty payload', () => {
    const store = createAccountStore({ status: 'unavailable', db: null, binding: null, reason: 'no_sqlite_binding' });
    const restored = store.restore();
    expect(restored.status).toBe('unavailable');
    expect(restored.reason).toBe('no_sqlite_binding');
  });

  it('propagates degraded/not_writable from openAccountDatabase without reading anything', () => {
    const store = createAccountStore({ status: 'degraded', db: null, binding: null, reason: 'not_writable' });
    const restored = store.restore();
    expect(restored.status).toBe('degraded');
    expect(restored.reason).toBe('not_writable');
    expect(restored.gameRunning).toBe(false);
  });

  it('close() never throws when the store failed to open (db is null)', () => {
    const store = createAccountStore({ status: 'unavailable', db: null, binding: null, reason: 'no_sqlite_binding' });
    expect(() => {
      store.close();
    }).not.toThrow();
  });

  it('never constructs a resolved status literal in its source (AD-025 guard)', () => {
    const source = fs.readFileSync(path.join(__dirname, 'account-store.ts'), 'utf8');
    expect(source).not.toMatch(/status:\s*['"]resolved['"]/);
  });
});
