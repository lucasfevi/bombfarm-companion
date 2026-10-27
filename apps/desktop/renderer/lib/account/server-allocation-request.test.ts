import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AccountPayload, AccountView } from '@bombfarm/contracts';
import { createServerAllocationRequester, heroIdsWithInexactPoints } from './server-allocation-request';

const OFFLINE_FIXTURE = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'account-offline.json');
const payload = JSON.parse(readFileSync(OFFLINE_FIXTURE, 'utf8')) as AccountPayload;
const INEXACT_HERO = '26863';

function view(overrides: Partial<AccountPayload> = {}): AccountView {
  return {
    payload: { ...payload, ...overrides },
    gameRunning: true,
    store: { status: 'ok', reason: null, binding: 'better-sqlite3' },
  };
}

function withAlloc(heroId: string): Partial<AccountPayload> {
  return {
    heroes: payload.heroes?.map((hero) =>
      (hero as { id?: unknown }).id === heroId ? { ...(hero as object), alloc: [0, 0, 0, 0, 0, 0, 0, 0] } : hero,
    ),
  };
}

function heroesReadAt(capturedAt: string): Partial<AccountPayload> {
  if (payload.fidelity === undefined) throw new Error('the offline fixture carries fidelity');
  return { fidelity: { ...payload.fidelity, heroes: { status: 'resolved', capturedAt } } };
}

describe('heroIdsWithInexactPoints', () => {
  it('names a hero whose sheet does not invert exactly, and not one that does', () => {
    const named = heroIdsWithInexactPoints(view());
    expect(named).toContain(INEXACT_HERO);
    expect(named.length).toBeLessThan(payload.heroes?.length ?? 0);
  });

  it('stops naming a hero once it carries the server allocation', () => {
    expect(heroIdsWithInexactPoints(view(withAlloc(INEXACT_HERO)))).not.toContain(INEXACT_HERO);
  });
});

describe('createServerAllocationRequester', () => {
  it('asks once per heroes read, and again when the heroes are read anew', () => {
    const asked: (readonly string[])[] = [];
    const requestFor = createServerAllocationRequester((heroIds) => asked.push(heroIds));

    requestFor(view(heroesReadAt('2026-10-26T10:00:00.000Z')));
    requestFor(view(heroesReadAt('2026-10-26T10:00:00.000Z')));
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain(INEXACT_HERO);

    requestFor(view(heroesReadAt('2026-10-26T10:01:00.000Z')));
    expect(asked).toHaveLength(2);
  });

  it('asks nothing for a payload with no heroes', () => {
    const asked: (readonly string[])[] = [];
    createServerAllocationRequester((heroIds) => asked.push(heroIds))(view({ heroes: [] }));
    expect(asked).toEqual([]);
  });
});
