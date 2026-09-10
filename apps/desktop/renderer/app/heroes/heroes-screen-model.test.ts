import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AccountFidelity, AccountPayload, AccountView } from '@bombfarm/contracts';
import type { AccountViewState } from '../../lib/account/account-view-store';
import { heroesScreenModel } from './heroes-screen-model';

const OFFLINE_FIXTURE = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'account-offline.json');

function offlinePayload(): AccountPayload {
  return JSON.parse(readFileSync(OFFLINE_FIXTURE, 'utf8')) as AccountPayload;
}

/** The heroes section unread, every other section exactly as the fixture asserted it. */
function heroesSectionUnread(payload: AccountPayload): AccountPayload {
  const fidelity: AccountFidelity = {
    account: payload.fidelity?.account ?? { status: 'missing' },
    heroes: { status: 'missing' },
    skills: payload.fidelity?.skills ?? { status: 'missing' },
    casa: payload.fidelity?.casa ?? { status: 'missing' },
    items: payload.fidelity?.items ?? { status: 'missing' },
  };
  return { ...payload, heroes: [], fidelity };
}

function loaded(payload: AccountPayload): AccountViewState {
  const view: AccountView = {
    payload,
    gameRunning: false,
    store: { status: 'ok', reason: null, binding: 'better-sqlite3' },
  };
  return { status: 'loaded', view, applied: 1, key: 'k' };
}

describe('heroesScreenModel — the account seam states', () => {
  it('is loading while the first read is in flight', () => {
    expect(heroesScreenModel({ status: 'loading', applied: 0, key: null }).kind).toBe('loading');
  });

  it('reports the missing preload bridge rather than an empty roster', () => {
    expect(heroesScreenModel({ status: 'bridge-unavailable', applied: 0, key: null }).kind).toBe(
      'bridgeUnavailable',
    );
  });

  it('carries the read failure as diagnostic data, never as an account with no heroes', () => {
    const model = heroesScreenModel({ status: 'error', message: 'EBUSY', applied: 0, key: null });
    expect(model).toEqual({ kind: 'readFailed', message: 'EBUSY' });
  });
});

describe('heroesScreenModel — the roster', () => {
  it('orders the committed offline account into rows', () => {
    const model = heroesScreenModel(loaded(offlinePayload()));
    expect(model.kind).toBe('roster');
    if (model.kind !== 'roster') return;
    expect(model.rows).toHaveLength(13);
    expect(model.roster.heroes).toHaveLength(13);
  });
});

describe('heroesScreenModel — the two empty answers stay apart', () => {
  it('says nothing was read when the heroes section carries no capture time', () => {
    const model = heroesScreenModel(loaded(heroesSectionUnread(offlinePayload())));
    expect(model.kind).toBe('neverRead');
  });

  it('says nothing was read when the payload could not be parsed at all', () => {
    const model = heroesScreenModel(loaded({}));
    expect(model.kind).toBe('neverRead');
  });

  it('says the account owns no heroes only when a real read came back with none', () => {
    const payload = offlinePayload();
    const model = heroesScreenModel(loaded({ ...payload, heroes: [] }));
    expect(model.kind).toBe('noHeroes');
  });

  it('never answers the same way for "not read yet" and "read, and there are none"', () => {
    const payload = offlinePayload();
    const notRead = heroesScreenModel(loaded(heroesSectionUnread(payload)));
    const readAndEmpty = heroesScreenModel(loaded({ ...payload, heroes: [] }));

    expect(notRead.kind).not.toBe(readAndEmpty.kind);
  });
});
