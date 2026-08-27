import type { AccountSection } from '@bombfarm/contracts';
import type { SchemaLevel } from '@bombfarm/domain/save-schema';
import { describe, expect, it } from 'vitest';
import { ROUTE_FINGERPRINTS, type RouteFingerprint } from './fingerprints.js';
import { identifyObservedBody } from './identify-observed-body.js';
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
