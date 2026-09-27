import type { AccountSection } from '@bombfarm/contracts';
import type { SchemaLevel } from '@bombfarm/domain/save-schema';
import { describe, expect, it } from 'vitest';
import { ROUTE_FINGERPRINTS, type RouteFingerprint } from './fingerprints.js';
import { diagnoseObservedBodyDrift, identifyObservedBody } from './identify-observed-body.js';
import { fixturePath, loadFixtureJson, required, requireFixture } from './test-fixtures.js';

const bodiesPresent = requireFixture(fixturePath('api-bodies.json'), 'identifyObservedBody route corpus check');
const bodies = bodiesPresent ? loadFixtureJson('api-bodies.json') : null;

describe('identifyObservedBody: identifies a real committed route body by shape alone, one route at a time', () => {
  const cases: ReadonlyArray<{ readonly path: string; readonly section: AccountSection }> = [
    { path: '/state', section: 'account' },
    { path: '/roster', section: 'heroes' },
    { path: '/skill/state', section: 'skills' },
    { path: '/rotation', section: 'casa' },
    { path: '/inventory', section: 'items' },
  ];

  for (const { path, section } of cases) {
    it(`identifies the real committed ${path} body as ${section}`, () => {
      if (!bodies) return;
      const body = required(bodies[path], `missing fixture body for ${path}`);
      expect(identifyObservedBody(body)).toEqual({ kind: 'identified', section });
    });
  }
});

describe('identifyObservedBody: never guesses', () => {
  it('returns unidentified for a shape matching none of the declared routes', () => {
    expect(identifyObservedBody({ totally: 'unrecognisable', shape: 1 })).toEqual({ kind: 'unidentified' });
  });

  it('returns unidentified, not a best-effort match, for a route body drifted by one added key', () => {
    if (!bodies) return;
    const mutated = { ...required(bodies['/rotation'], 'missing /rotation body'), extra_field: 1 };
    expect(identifyObservedBody(mutated)).toEqual({ kind: 'unidentified' });
  });

  it('returns unidentified, not a best-effort match, for a route body missing one required key', () => {
    if (!bodies) return;
    const body = { ...required(bodies['/rotation'], 'missing /rotation body') };
    delete (body as Record<string, unknown>).rescues_left;
    expect(identifyObservedBody(body)).toEqual({ kind: 'unidentified' });
  });

  it('returns unidentified for a /state body from before the sell gate — the tap no longer accepts the thirteen-key shape', () => {
    if (!bodies) return;
    const { client_can_sell, sell_phase, sell_mode, ...preSellGate } = required(bodies['/state'], 'missing /state body');
    expect([client_can_sell, sell_phase, sell_mode].every((value) => value !== undefined)).toBe(true);
    expect(identifyObservedBody(preSellGate)).toEqual({ kind: 'unidentified' });
  });

  it('returns unidentified for a non-object body without throwing', () => {
    expect(identifyObservedBody('not an object')).toEqual({ kind: 'unidentified' });
    expect(identifyObservedBody(null)).toEqual({ kind: 'unidentified' });
    expect(identifyObservedBody(undefined)).toEqual({ kind: 'unidentified' });
    expect(identifyObservedBody(42)).toEqual({ kind: 'unidentified' });
    expect(identifyObservedBody([1, 2, 3])).toEqual({ kind: 'unidentified' });
  });

  it('never resolves ambiguity by preferring one route: two fingerprints matching the same body both come back named', () => {
    const sharedLevel: SchemaLevel = { keys: ['x'] };
    const sharedFingerprint = (root: string): RouteFingerprint => ({
      root,
      level: sharedLevel,
      gameBuild: 'test',
      capturedAt: '2026-08-25T00:00:00.000Z',
      sourceArtifact: 'test-only fingerprint, not a real capture',
    });
    const ambiguousFingerprints: Readonly<Record<AccountSection, RouteFingerprint>> = {
      account: sharedFingerprint('account'),
      heroes: sharedFingerprint('heroes'),
      skills: ROUTE_FINGERPRINTS.skills,
      casa: ROUTE_FINGERPRINTS.casa,
      items: ROUTE_FINGERPRINTS.items,
    };

    const result = identifyObservedBody({ x: 1 }, ambiguousFingerprints);

    expect(result).toEqual({ kind: 'ambiguous', sections: ['account', 'heroes'] });
  });
});
describe('diagnoseObservedBodyDrift — why an unidentified body was rejected', () => {
  const stateBody = (): Record<string, unknown> => {
    const body: Record<string, unknown> = {};
    for (const key of ROUTE_FINGERPRINTS.account.level.keys) body[key] = 0;
    return body;
  };

  it('names the section and the added key when the game adds one to a body we already read', () => {
    expect(diagnoseObservedBodyDrift({ ...stateBody(), a_key_the_game_added: {} })).toEqual([
      { section: 'account', addedKeys: ['account.a_key_the_game_added'] },
    ]);
  });

  it('reports the real regression: the account body rejected outright for one added key', () => {
    const drifted = { ...stateBody(), some_new_stash: { owned: false, slots: 0, cap: 0, unit: 150 } };
    expect(identifyObservedBody(drifted).kind).toBe('unidentified');

    const [diagnosis, ...rest] = diagnoseObservedBodyDrift(drifted);
    expect(rest).toEqual([]);
    expect(diagnosis?.section).toBe('account');
    expect(diagnosis?.addedKeys).toEqual(['account.some_new_stash']);
  });

  it('stays quiet for a body that is simply some other route — the common case', () => {
    expect(diagnoseObservedBodyDrift({ unlocked: ['FIRST_GATE'] })).toEqual([]);
    expect(diagnoseObservedBodyDrift({ gold_per_prop: '254', xp_per_prop: 160, phase: 10 })).toEqual([]);
  });

  it('stays quiet for a body missing a required key — that is a removal, not an addition', () => {
    const { gold, ...withoutGold } = stateBody();
    expect(gold).toBeDefined();
    expect(identifyObservedBody(withoutGold).kind).toBe('unidentified');
    expect(diagnoseObservedBodyDrift(withoutGold)).toEqual([]);
  });

  it('a body that still matches its fingerprint exactly reports no drift', () => {
    expect(identifyObservedBody(stateBody()).kind).toBe('identified');
    expect(diagnoseObservedBodyDrift(stateBody())).toEqual([]);
  });

  it('refuses a non-object without throwing', () => {
    expect(diagnoseObservedBodyDrift(null)).toEqual([]);
    expect(diagnoseObservedBodyDrift([1, 2, 3])).toEqual([]);
    expect(diagnoseObservedBodyDrift('a string')).toEqual([]);
  });
});
