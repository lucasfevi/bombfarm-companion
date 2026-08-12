import { describe, expect, it } from 'vitest';
import type { ConsentRecord } from '@bombfarm/game-api';
import { detectAvailableBindings, openTestAccountDb, warnForUnavailableBindings } from '../storage/test-support.js';
import { createConsentStore } from './consent-store.js';

const availableBindings = detectAvailableBindings();
warnForUnavailableBindings(availableBindings);

describe.each(availableBindings)('createConsentStore over the real account_meta table (%s)', (binding) => {
  it('read() returns initialConsent() (unasked) when no row has ever been written', () => {
    const open = openTestAccountDb(binding);
    const store = createConsentStore(open.db);
    expect(store.read()).toEqual({ decision: 'unasked', textVersion: 1 });
  });

  it('write() then read() round-trips a granted record', () => {
    const open = openTestAccountDb(binding);
    const store = createConsentStore(open.db);
    const granted: ConsentRecord = { decision: 'granted', grantedAt: '2026-08-12T13:15:38.000Z', textVersion: 1 };

    store.write(granted);

    expect(store.read()).toEqual(granted);
  });

  it('a later write() overwrites the earlier one — one row, not an accumulating history', () => {
    const open = openTestAccountDb(binding);
    const store = createConsentStore(open.db);
    store.write({ decision: 'granted', grantedAt: '2026-08-12T13:15:38.000Z', textVersion: 1 });
    store.write({ decision: 'revoked', textVersion: 1 });

    expect(store.read()).toEqual({ decision: 'revoked', textVersion: 1 });
  });

  it('a malformed JSON value in the row falls back to initialConsent() — the safe direction (re-ask)', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    open.db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run('consent_v1', '{not valid json');

    const store = createConsentStore(open.db);

    expect(store.read()).toEqual({ decision: 'unasked', textVersion: 1 });
  });

  it('a structurally wrong value (missing decision) falls back to initialConsent()', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    open.db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run('consent_v1', JSON.stringify({ textVersion: 1 }));

    const store = createConsentStore(open.db);

    expect(store.read()).toEqual({ decision: 'unasked', textVersion: 1 });
  });

  it('an unknown decision literal falls back to initialConsent()', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    open.db
      .prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)')
      .run('consent_v1', JSON.stringify({ decision: 'maybe', textVersion: 1 }));

    const store = createConsentStore(open.db);

    expect(store.read()).toEqual({ decision: 'unasked', textVersion: 1 });
  });

  it('does not disturb other account_meta rows (e.g. account_id)', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    open.db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run('account_id', '486');

    const store = createConsentStore(open.db);
    store.write({ decision: 'declined', textVersion: 1 });

    const row = open.db.prepare('SELECT value FROM account_meta WHERE key = ?').get('account_id') as
      | { value: string }
      | undefined;
    expect(row?.value).toBe('486');
  });
});

describe('createConsentStore(null) — a db that never opened', () => {
  it('read() returns initialConsent() without throwing', () => {
    const store = createConsentStore(null);
    expect(store.read()).toEqual({ decision: 'unasked', textVersion: 1 });
  });

  it('write() is a silent no-op without throwing', () => {
    const store = createConsentStore(null);
    expect(() => {
      store.write({ decision: 'granted', grantedAt: '2026-08-12T00:00:00.000Z', textVersion: 1 });
    }).not.toThrow();
  });
});
