/**
 * MP5 F4 (T5) — `checkShape` over the real committed route bodies. The `an unknown extra key ->
 * ok:true` case below is INVERTED, not deleted (design §2.1): the old assertion actively asserted
 * the bug this feature exists to fix — a shape.ts header that said "an extra key is additive and
 * logged, never a failure." It no longer is.
 */
import { describe, expect, it } from 'vitest';
import { ROUTE_FINGERPRINTS } from './fingerprints.js';
import { ROUTES } from './routes.js';
import { checkShape } from './shape.js';
import { fixturePath, loadFixtureJson, required, requireFixture } from './test-fixtures.js';

const bodiesPresent = requireFixture(fixturePath('api-bodies.json'), 'checkShape route body checks');
const bodies = bodiesPresent ? loadFixtureJson('api-bodies.json') : null;

describe('checkShape — per route, over the committed bodies (LAR-19, LAR-20, MP5 F4)', () => {
  for (const route of ROUTES) {
    const fingerprint = ROUTE_FINGERPRINTS[route.section];

    it(`${route.path}: resolves ok over the real committed body`, () => {
      if (!bodies) return;
      const body = bodies[route.path] ?? {};
      const result = checkShape(body, fingerprint);
      expect(result.ok).toBe(true);
    });

    it(`${route.path}: removing one required key -> ok:false with exactly that key in missingKeys`, () => {
      if (!bodies) return;
      const body = bodies[route.path] ?? {};
      const missingKey = required(fingerprint.level.keys[0], `${route.path} fingerprint has no declared keys`);
      const corrupted = Object.fromEntries(Object.entries(body).filter(([key]) => key !== missingKey));

      const result = checkShape(corrupted, fingerprint);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.missingKeys).toEqual([`${fingerprint.root}.${missingKey}`]);
      }
    });

    it(`${route.path}: an unknown extra key -> ok:false, naming it as added (INVERTED — was ok:true, MP5 F4)`, () => {
      if (!bodies) return;
      const body = bodies[route.path] ?? {};
      const withExtra = { ...body, a_brand_new_field_the_fingerprint_does_not_know: true };

      const result = checkShape(withExtra, fingerprint);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.addedKeys).toContain(`${fingerprint.root}.a_brand_new_field_the_fingerprint_does_not_know`);
        expect(result.missingKeys).toEqual([]);
      }
    });
  }

  it('removing every required key reports every one of them as missing, path-qualified', () => {
    const fingerprint = ROUTE_FINGERPRINTS.account;
    const result = checkShape({}, fingerprint);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missingKeys).toEqual(fingerprint.level.keys.map((key) => `${fingerprint.root}.${key}`));
    }
  });
});
