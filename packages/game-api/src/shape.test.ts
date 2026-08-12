import { describe, expect, it } from 'vitest';
import { ROUTE_FINGERPRINTS } from './fingerprints.js';
import { ROUTES } from './routes.js';
import { checkShape } from './shape.js';
import { loadFixtureJson } from './test-fixtures.js';

const bodies = loadFixtureJson('api-bodies.json');

describe('checkShape — per route, over the committed bodies (LAR-19, LAR-20)', () => {
  for (const route of ROUTES) {
    const fingerprint = ROUTE_FINGERPRINTS[route.section];
    const body = bodies[route.path] ?? {};

    it(`${route.path}: resolves ok over the real committed body`, () => {
      const result = checkShape(body, fingerprint);
      expect(result.ok).toBe(true);
    });

    it(`${route.path}: removing one required key -> ok:false with exactly that key in missingKeys`, () => {
      const [missingKey] = fingerprint.requiredKeys;
      expect(missingKey).toBeDefined();
      const corrupted = Object.fromEntries(Object.entries(body).filter(([key]) => key !== missingKey));

      const result = checkShape(corrupted, fingerprint);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.missingKeys).toEqual([missingKey]);
      }
    });

    it(`${route.path}: an unknown extra key -> ok:true and the unknown key is returned for logging`, () => {
      const withExtra = { ...body, a_brand_new_field_the_fingerprint_does_not_know: true };

      const result = checkShape(withExtra, fingerprint);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.unknownKeys).toContain('a_brand_new_field_the_fingerprint_does_not_know');
      }
    });
  }

  it('removing every required key reports every one of them as missing', () => {
    const fingerprint = ROUTE_FINGERPRINTS.account;
    const result = checkShape({}, fingerprint);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missingKeys).toEqual(fingerprint.requiredKeys);
    }
  });
});
