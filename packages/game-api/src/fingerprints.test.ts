/**
 * MP5 F4 (T5) — the deepened route fingerprint corpus check and its three named red states.
 *
 * Replaces the previous subset assertion (`for (const key of fingerprint's flat required-key
 * list) expect(bodyKeys.has(key)).toBe(true)`) — unfalsifiable on either an addition or a
 * removal once the list was transcribed from the body it checks, which is exactly how the
 * `skills` section's old required-key list acquired `refunds` before this feature. This suite
 * runs equality modulo the fingerprint's own named allowance instead, at every declared level.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { AccountSection } from '@bombfarm/contracts';
import { checkSchema, SCHEMA_LEVELS, type SchemaLevel } from '@bombfarm/domain/save-schema';
import { checkSectionShape, ROUTE_FINGERPRINTS, SECTION_FINGERPRINTS } from './fingerprints.js';
import { ROUTES } from './routes.js';
import { fixturePath, loadFixtureJson, required, requireFixture } from './test-fixtures.js';

function readFileSyncSelf(name: string): string {
  return readFileSync(join(__dirname, name), 'utf8');
}

const PRIMARY_PATH = fixturePath('api-bodies.json');
const AFTER_PATH = fixturePath('api-bodies-after.json');

const primaryPresent = requireFixture(PRIMARY_PATH, 'route fingerprint corpus check');
const bodies = primaryPresent ? loadFixtureJson('api-bodies.json') : null;

const afterPresent = requireFixture(AFTER_PATH, 'second-capture key-set equality witness');
const afterBodies = afterPresent ? loadFixtureJson('api-bodies-after.json') : null;

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('ROUTE_FINGERPRINTS (LAR-18, MP5 F4)', () => {
  for (const section of Object.keys(ROUTE_FINGERPRINTS) as AccountSection[]) {
    const fingerprint = ROUTE_FINGERPRINTS[section];

    it(`${section}: has a non-empty root/level, a game build, an ISO capturedAt, and names its sourceArtifact (MSG-30)`, () => {
      expect(fingerprint.root.length).toBeGreaterThan(0);
      expect(fingerprint.level.keys.length).toBeGreaterThan(0);
      expect(fingerprint.gameBuild.length).toBeGreaterThan(0);
      expect(() => new Date(fingerprint.capturedAt).toISOString()).not.toThrow();
      expect(fingerprint.sourceArtifact).toContain('api-bodies.json');
      expect(fingerprint.sourceArtifact).toContain('2026-08-12');
    });
  }

  it('every fingerprinted route body is ok:true — equality modulo allowance, never a subset (MSG-08)', () => {
    if (!bodies) return;
    for (const route of ROUTES) {
      const fingerprint = ROUTE_FINGERPRINTS[route.section];
      const body = bodies[route.path];
      expect(body, `missing fixture body for ${route.path}`).toBeDefined();
      expect(checkSchema(body, fingerprint)).toEqual({ ok: true });
    }
  });

  it('account_id and player_name are declared allowance (never keys) on /state (the scrub)', () => {
    const stateFingerprint = ROUTE_FINGERPRINTS.account;
    expect(stateFingerprint.level.keys).not.toContain('account_id');
    expect(stateFingerprint.level.keys).not.toContain('player_name');
    expect(stateFingerprint.level.allowance).toEqual(['account_id', 'player_name']);
  });

  it('the scrubbed /state fixture itself carries neither account_id nor player_name', () => {
    if (!bodies) return;
    const stateBody = bodies['/state'];
    expect(Object.keys(stateBody ?? {})).not.toContain('account_id');
    expect(Object.keys(stateBody ?? {})).not.toContain('player_name');
  });

  describe('three named red states — one mutation of the committed skills route body each', () => {
    it('RED 1: removing skills.totals.vagas_campo reports it missing, path-qualified', () => {
      if (!bodies) return;
      const mutated = deepClone(required(bodies['/skill/state'], 'missing /skill/state body'));
      delete (mutated.totals as Record<string, unknown>).vagas_campo;
      expect(checkSchema(mutated, ROUTE_FINGERPRINTS.skills)).toEqual({
        ok: false,
        missingKeys: ['skills.totals.vagas_campo'],
        addedKeys: [],
      });
    });

    it('RED 2: adding skills.totals.something_new reports it added, path-qualified', () => {
      if (!bodies) return;
      const mutated = deepClone(required(bodies['/skill/state'], 'missing /skill/state body'));
      (mutated.totals as Record<string, unknown>).something_new = 1;
      expect(checkSchema(mutated, ROUTE_FINGERPRINTS.skills)).toEqual({
        ok: false,
        missingKeys: [],
        addedKeys: ['skills.totals.something_new'],
      });
    });

    it('RED 3: adding a TOP-LEVEL something_new on the route body reports it added, demonstrated separately from the nested case', () => {
      if (!bodies) return;
      const mutated = deepClone(required(bodies['/skill/state'], 'missing /skill/state body'));
      mutated.something_new = 1;
      expect(checkSchema(mutated, ROUTE_FINGERPRINTS.skills)).toEqual({
        ok: false,
        missingKeys: [],
        addedKeys: ['skills.something_new'],
      });
    });
  });

  it('api-bodies-after.json is a second WITNESS, not a competing baseline: identical key sets at every declared level (design §2.2)', () => {
    if (!afterBodies) return;
    for (const route of ROUTES) {
      const fingerprint = ROUTE_FINGERPRINTS[route.section];
      const body = afterBodies[route.path];
      expect(body, `missing fixture body for ${route.path} in api-bodies-after.json`).toBeDefined();
      // client.test.ts:47 already documents the relationship: "differs from api-bodies.json in
      // exactly five dimensions (LAR-09)" — a VALUE twin from the same capture session, not a
      // schema twin. checkSchema only ever inspects key sets, never values, so this passing
      // confirms the key space held stable across the in-game state change between captures.
      expect(checkSchema(body, fingerprint)).toEqual({ ok: true });
    }
  });

  it('non-vacuity: /roster.heroes, /inventory.items, /rotation.heroes are non-empty in the committed corpus (MSG-06)', () => {
    if (!bodies) return;
    const roster = required(bodies['/roster'], 'missing /roster body');
    const inventory = required(bodies['/inventory'], 'missing /inventory body');
    const rotation = required(bodies['/rotation'], 'missing /rotation body');
    expect((roster.heroes as unknown[]).length, 'roster.heroes').toBeGreaterThan(0);
    expect((inventory.items as unknown[]).length, 'inventory.items').toBeGreaterThan(0);
    expect((rotation.heroes as unknown[]).length, 'rotation.heroes').toBeGreaterThan(0);
  });

  it('non-vacuity: item.slot is present on at least one /inventory item and absent on at least one (AD-087)', () => {
    if (!bodies) return;
    const items = required(bodies['/inventory'], 'missing /inventory body').items as Record<string, unknown>[];
    const withSlot = items.filter((item) => 'slot' in item);
    const withoutSlot = items.filter((item) => !('slot' in item));
    expect(withSlot.length, 'items WITH slot').toBeGreaterThan(0);
    expect(withoutSlot.length, 'items WITHOUT slot').toBeGreaterThan(0);
  });

  it('MSG-29: no runtime override exists — no env var and no refresh function name the fingerprint', () => {
    // Mirrors the literal verification command (`git grep -nE
    // 'process\.env\.[A-Z_]*FINGERPRINT|refreshFingerprint' packages/game-api/src`) as an
    // in-suite assertion so it runs on every `pnpm --filter @bombfarm/game-api test`, not only
    // when a human remembers to run the shell command by hand.
    const overridePattern = /process\.env\.[A-Z_]*FINGERPRINT|refreshFingerprint/;
    expect(overridePattern.test(readFileSyncSelf('fingerprints.ts'))).toBe(false);
    expect(overridePattern.test(readFileSyncSelf('shape.ts'))).toBe(false);
    expect(overridePattern.test(readFileSyncSelf('routes.ts'))).toBe(false);
  });

  it('CI=1 fails loudly when the primary corpus artifact is absent (MSG-09/MSG-10)', () => {
    const missingPath = fixturePath('api-bodies.json').replace('api-bodies.json', 'does-not-exist.json');
    vi.stubEnv('CI', '1');
    try {
      expect(() => requireFixture(missingPath, 'route fingerprint corpus check')).toThrow(/is missing in CI/);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('outside CI, a missing artifact returns false (visible skip) rather than throwing', () => {
    const missingPath = fixturePath('api-bodies.json').replace('api-bodies.json', 'does-not-exist.json');
    vi.stubEnv('CI', '');
    try {
      expect(requireFixture(missingPath, 'route fingerprint corpus check')).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('SECTION_FINGERPRINTS — the projected shapes derive from ROUTE_FINGERPRINTS (design §5.3)', () => {
  it('account and skills project as identity — their section fingerprint IS their route fingerprint', () => {
    expect(SECTION_FINGERPRINTS.account).toEqual({ kind: 'object', ...ROUTE_FINGERPRINTS.account });
    expect(SECTION_FINGERPRINTS.skills).toEqual({ kind: 'object', ...ROUTE_FINGERPRINTS.skills });
  });

  it('casa: the section level equals the `casa` child declared inside the /rotation route level', () => {
    const routeCasaChild = ROUTE_FINGERPRINTS.casa.level.children?.casa;
    expect(routeCasaChild?.kind).toBe('object');
    if (routeCasaChild?.kind === 'object') {
      expect(SECTION_FINGERPRINTS.casa).toMatchObject({ kind: 'object', root: 'casa', level: routeCasaChild.level });
    }
    expect((SECTION_FINGERPRINTS.casa as { level: SchemaLevel }).level).toEqual(SCHEMA_LEVELS.casa);
  });

  it('heroes: the section element equals the array element declared inside the /roster route level', () => {
    const routeHeroesChild = ROUTE_FINGERPRINTS.heroes.level.children?.heroes;
    expect(routeHeroesChild?.kind).toBe('array');
    if (routeHeroesChild?.kind === 'array') {
      expect((SECTION_FINGERPRINTS.heroes as { element: SchemaLevel }).element).toEqual(routeHeroesChild.element);
    }
    expect((SECTION_FINGERPRINTS.heroes as { element: SchemaLevel }).element).toEqual(SCHEMA_LEVELS.hero);
  });

  it('items: the section element equals the array element declared inside the /inventory route level', () => {
    const routeItemsChild = ROUTE_FINGERPRINTS.items.level.children?.items;
    expect(routeItemsChild?.kind).toBe('array');
    if (routeItemsChild?.kind === 'array') {
      expect((SECTION_FINGERPRINTS.items as { element: SchemaLevel }).element).toEqual(routeItemsChild.element);
    }
    expect((SECTION_FINGERPRINTS.items as { element: SchemaLevel }).element).toEqual(SCHEMA_LEVELS.item);
  });

  it('checkSectionShape accepts the real committed corpus once projected, for every section', () => {
    if (!bodies) return;
    for (const route of ROUTES) {
      const body = required(bodies[route.path], `missing fixture body for ${route.path}`);
      const projected = route.project(body);
      expect(checkSectionShape(projected, SECTION_FINGERPRINTS[route.section])).toEqual({ ok: true });
    }
  });

  it('checkSectionShape on an array section names the offending element root[i].key, never root.root[i].key', () => {
    if (!bodies) return;
    const rosterBody = required(bodies['/roster'], 'missing /roster body');
    const heroes = deepClone(rosterBody.heroes as Record<string, unknown>[]);
    const thirdHero = required(heroes[2], 'expected a third roster hero in the committed corpus');
    delete thirdHero.in_market;
    expect(checkSectionShape(heroes, SECTION_FINGERPRINTS.heroes)).toEqual({
      ok: false,
      missingKeys: ['heroes[2].in_market'],
      addedKeys: [],
    });
  });
});
