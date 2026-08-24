import { describe, expect, it } from 'vitest';
import { CONSENT_TEXT_VERSION } from '@bombfarm/game-api';
import { consentRecord, grantedConsent } from '@bombfarm/game-api/test-fixtures';
import { detectAvailableBindings, openTestAccountDb, warnForUnavailableBindings } from '../storage/test-support.js';
import { createConsentStore } from './consent-store.js';

const availableBindings = detectAvailableBindings();
warnForUnavailableBindings(availableBindings);

const CURRENT_META_KEY = `consent_v${String(CONSENT_TEXT_VERSION)}`;

describe.each(availableBindings)('createConsentStore over the real account_meta table (%s)', (binding) => {
  it('read() returns initialConsent() (unasked) when no row has ever been written', () => {
    const open = openTestAccountDb(binding);
    const store = createConsentStore(open.db);
    expect(store.read()).toEqual(consentRecord({ decision: 'unasked' }));
  });

  it('write() then read() round-trips a granted record', () => {
    const open = openTestAccountDb(binding);
    const store = createConsentStore(open.db);
    const granted = grantedConsent('2026-08-12T13:15:38.000Z');

    store.write(granted);

    expect(store.read()).toEqual(granted);
  });

  it('write() then read() round-trips textLocale intact', () => {
    const open = openTestAccountDb(binding);
    const store = createConsentStore(open.db);
    const granted = grantedConsent('2026-08-12T13:15:38.000Z', { textLocale: 'pt-BR' });

    store.write(granted);

    expect(store.read()).toEqual(granted);
    expect(store.read().textLocale).toBe('pt-BR');
  });

  it('a later write() overwrites the earlier one — one row, not an accumulating history', () => {
    const open = openTestAccountDb(binding);
    const store = createConsentStore(open.db);
    store.write(grantedConsent('2026-08-12T13:15:38.000Z'));
    store.write(consentRecord({ decision: 'revoked' }));

    expect(store.read()).toEqual(consentRecord({ decision: 'revoked' }));
  });

  it('a malformed JSON value in the row falls back to initialConsent() — the safe direction (re-ask)', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    open.db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run(CURRENT_META_KEY, '{not valid json');

    const store = createConsentStore(open.db);

    expect(store.read()).toEqual(consentRecord({ decision: 'unasked' }));
  });

  it('a structurally wrong value (missing decision) falls back to initialConsent()', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    open.db
      .prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)')
      .run(CURRENT_META_KEY, JSON.stringify({ textVersion: CONSENT_TEXT_VERSION }));

    const store = createConsentStore(open.db);

    expect(store.read()).toEqual(consentRecord({ decision: 'unasked' }));
  });

  it('an unknown decision literal falls back to initialConsent()', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    open.db
      .prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)')
      .run(CURRENT_META_KEY, JSON.stringify({ decision: 'maybe', textVersion: CONSENT_TEXT_VERSION }));

    const store = createConsentStore(open.db);

    expect(store.read()).toEqual(consentRecord({ decision: 'unasked' }));
  });

  it('does not disturb other account_meta rows (e.g. account_id)', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    open.db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run('account_id', '486');

    const store = createConsentStore(open.db);
    store.write(consentRecord({ decision: 'declined' }));

    const row = open.db.prepare('SELECT value FROM account_meta WHERE key = ?').get('account_id') as
      | { value: string }
      | undefined;
    expect(row?.value).toBe('486');
  });

  it('a lone version-1 row does not authorise the current disclosure — read() falls back to unasked at the current version', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    open.db
      .prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)')
      .run('consent_v1', JSON.stringify({ decision: 'granted', grantedAt: '2026-08-12T13:15:38.000Z', textVersion: 1 }));

    const store = createConsentStore(open.db);

    expect(store.read()).toEqual(consentRecord({ decision: 'unasked' }));
  });

  it('writing a grant at the current version leaves the prior version-1 row in place, untouched', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    const priorGrant = { decision: 'granted', grantedAt: '2026-08-12T13:15:38.000Z', textVersion: 1 };
    open.db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run('consent_v1', JSON.stringify(priorGrant));

    const store = createConsentStore(open.db);
    store.write(grantedConsent('2026-08-20T00:00:00.000Z'));

    const row = open.db.prepare('SELECT value FROM account_meta WHERE key = ?').get('consent_v1') as
      | { value: string }
      | undefined;
    if (!row) throw new Error('expected the prior version-1 row to still be present');
    expect(JSON.parse(row.value)).toEqual(priorGrant);
  });

  it('a relaunch — a second store opened over the same db — does not re-prompt after a grant at the current version', () => {
    const open = openTestAccountDb(binding);
    const firstLaunch = createConsentStore(open.db);
    firstLaunch.write(grantedConsent('2026-08-20T00:00:00.000Z'));

    const secondLaunch = createConsentStore(open.db);

    expect(secondLaunch.read()).toEqual(grantedConsent('2026-08-20T00:00:00.000Z'));
  });
});

describe('createConsentStore(null) — a db that never opened', () => {
  it('read() returns initialConsent() without throwing', () => {
    const store = createConsentStore(null);
    expect(store.read()).toEqual(consentRecord({ decision: 'unasked' }));
  });

  it('write() is a silent no-op without throwing', () => {
    const store = createConsentStore(null);
    expect(() => {
      store.write(grantedConsent('2026-08-12T00:00:00.000Z'));
    }).not.toThrow();
  });
});
