import { describe, expect, it } from 'vitest';
import { ROUTE_FINGERPRINTS } from './fingerprints.js';
import { ROUTES } from './routes.js';
import { loadFixtureJson } from './test-fixtures.js';

const bodies = loadFixtureJson('api-bodies.json');

describe('ROUTE_FINGERPRINTS (LAR-18)', () => {
  for (const section of Object.keys(ROUTE_FINGERPRINTS) as (keyof typeof ROUTE_FINGERPRINTS)[]) {
    const fingerprint = ROUTE_FINGERPRINTS[section];

    it(`${section} has a non-empty requiredKeys, a game build and an ISO capturedAt`, () => {
      expect(fingerprint.requiredKeys.length).toBeGreaterThan(0);
      expect(fingerprint.gameBuild.length).toBeGreaterThan(0);
      expect(() => new Date(fingerprint.capturedAt).toISOString()).not.toThrow();
      expect(new Date(fingerprint.capturedAt).toISOString()).not.toBe('Invalid Date');
    });
  }

  it('every fingerprint key set is a subset of the committed response body it fingerprints', () => {
    for (const route of ROUTES) {
      const fingerprint = ROUTE_FINGERPRINTS[route.section];
      const body = bodies[route.path];
      expect(body).toBeDefined();
      const bodyKeys = new Set(Object.keys(body ?? {}));
      for (const requiredKey of fingerprint.requiredKeys) {
        expect(bodyKeys.has(requiredKey)).toBe(true);
      }
    }
  });

  it('account_id and player_name are deliberately absent from the /state required set (the scrub)', () => {
    const stateFingerprint = ROUTE_FINGERPRINTS.account;
    expect(stateFingerprint.requiredKeys).not.toContain('account_id');
    expect(stateFingerprint.requiredKeys).not.toContain('player_name');
  });

  it('the scrubbed /state fixture itself carries neither account_id nor player_name', () => {
    const stateBody = bodies['/state'];
    expect(stateBody).toBeDefined();
    expect(Object.keys(stateBody ?? {})).not.toContain('account_id');
    expect(Object.keys(stateBody ?? {})).not.toContain('player_name');
  });
});
