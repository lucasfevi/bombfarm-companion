/**
 * The deepened route fingerprint corpus check and its three named red states.
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
import { checkSchema, ITEM_ESSENCE_KEYS, SCHEMA_LEVELS, type SchemaLevel } from '@bombfarm/domain/save-schema';
import {
  checkSectionShape,
  ROUTE_FINGERPRINTS,
  SECTION_FINGERPRINTS,
  STATE_RUNE_STASH_KEY,
  STATE_SELL_GATE_KEYS,
} from './fingerprints.js';
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

describe('ROUTE_FINGERPRINTS', () => {
  for (const section of Object.keys(ROUTE_FINGERPRINTS) as AccountSection[]) {
    const fingerprint = ROUTE_FINGERPRINTS[section];

    it(`${section}: has a non-empty root/level, a game build, an ISO capturedAt, and names its sourceArtifact`, () => {
      expect(fingerprint.root.length).toBeGreaterThan(0);
      expect(fingerprint.level.keys.length).toBeGreaterThan(0);
      expect(fingerprint.gameBuild.length).toBeGreaterThan(0);
      expect(() => new Date(fingerprint.capturedAt).toISOString()).not.toThrow();
      expect(fingerprint.sourceArtifact).toContain('api-bodies.json');
      expect(fingerprint.sourceArtifact).toContain('2026-08-12');
    });
  }

  it('every fingerprinted route body is ok:true — equality modulo allowance, never a subset', () => {
    if (!bodies) return;
    for (const route of ROUTES) {
      const fingerprint = ROUTE_FINGERPRINTS[route.section];
      const body = bodies[route.path];
      expect(body, `missing fixture body for ${route.path}`).toBeDefined();
      expect(checkSchema(body, fingerprint)).toEqual({ ok: true, absentUnreadKeys: [] });
    }
  });

  it('account_id and player_name are declared allowance (never keys) on /state (the scrub)', () => {
    const stateFingerprint = ROUTE_FINGERPRINTS.account;
    expect(stateFingerprint.level.keys).not.toContain('account_id');
    expect(stateFingerprint.level.keys).not.toContain('player_name');
    expect(stateFingerprint.level.allowance).toEqual(['account_id', 'player_name']);
  });

  describe('the sell-gate keys and the rune stash on /state — unread, so their absence never degrades the section', () => {
    it('client_can_sell, sell_phase, sell_mode and rune_stash are declared unread, never required', () => {
      const stateLevel = ROUTE_FINGERPRINTS.account.level;
      expect([...STATE_SELL_GATE_KEYS]).toEqual(['client_can_sell', 'sell_phase', 'sell_mode']);
      for (const key of [...STATE_SELL_GATE_KEYS, STATE_RUNE_STASH_KEY]) {
        expect(stateLevel.unread).toContain(key);
        expect(stateLevel.keys).not.toContain(key);
      }
      expect(stateLevel.optional).toBeUndefined();
    });

    it('the /state fixture carries all three sell-gate keys, with the observed value kinds: boolean, number, string', () => {
      if (!bodies) return;
      const stateBody = required(bodies['/state'], 'missing /state body');
      expect(typeof stateBody.client_can_sell).toBe('boolean');
      expect(typeof stateBody.sell_phase).toBe('number');
      expect(typeof stateBody.sell_mode).toBe('string');
    });

    it('a /state body without the sell gate stays ok and names the three keys absent, path-qualified', () => {
      if (!bodies) return;
      const { client_can_sell, sell_phase, sell_mode, ...preSellGate } = required(bodies['/state'], 'missing /state body');
      expect([client_can_sell, sell_phase, sell_mode].every((value) => value !== undefined)).toBe(true);
      expect(checkSchema(preSellGate, ROUTE_FINGERPRINTS.account)).toEqual({
        ok: true,
        absentUnreadKeys: ['account.client_can_sell', 'account.sell_phase', 'account.sell_mode'],
      });
    });

    it('a /state body without the rune stash stays ok and names that one key absent, path-qualified', () => {
      if (!bodies) return;
      const { rune_stash, ...preRuneStash } = required(bodies['/state'], 'missing /state body');
      expect(rune_stash).toBeDefined();
      expect(checkSchema(preRuneStash, ROUTE_FINGERPRINTS.account)).toEqual({
        ok: true,
        absentUnreadKeys: ['account.rune_stash'],
      });
    });

    it('a key the app reads, gold, still reports missing when it goes', () => {
      if (!bodies) return;
      const { gold, ...withoutGold } = required(bodies['/state'], 'missing /state body');
      expect(gold).toBeDefined();
      expect(checkSchema(withoutGold, ROUTE_FINGERPRINTS.account)).toEqual({
        ok: false,
        missingKeys: ['account.gold'],
        addedKeys: [],
        absentUnreadKeys: [],
      });
    });

    it('the account and items fingerprints are anchored on the later observations; the other three keep the 2026-08-12 anchor', () => {
      expect(ROUTE_FINGERPRINTS.account.capturedAt).toBe('2026-10-05T12:00:00.000Z');
      expect(ROUTE_FINGERPRINTS.account.sourceArtifact).toContain('2026-09-10');
      expect(ROUTE_FINGERPRINTS.account.sourceArtifact).toContain('2026-09-22');
      expect(ROUTE_FINGERPRINTS.account.sourceArtifact).toContain('2026-10-05');
      expect(ROUTE_FINGERPRINTS.account.gameBuild).toContain('25733721');
      expect(ROUTE_FINGERPRINTS.items.capturedAt).toBe('2026-10-05T12:00:00.000Z');
      expect(ROUTE_FINGERPRINTS.items.sourceArtifact).toContain('2026-10-05');
      expect(ROUTE_FINGERPRINTS.items.gameBuild).toContain('25733721');
      for (const section of ['heroes', 'skills', 'casa'] as const) {
        expect(ROUTE_FINGERPRINTS[section].capturedAt).toBe('2026-08-12T13:15:38.000Z');
        expect(ROUTE_FINGERPRINTS[section].sourceArtifact).not.toContain('2026-09-10');
        expect(ROUTE_FINGERPRINTS[section].sourceArtifact).not.toContain('2026-10-05');
      }
    });
  });

  describe('the essence keys — the balance is read, the pity counters and the odds are not', () => {
    it('essence is a required /state key and fusion_pity an unread one, and /state still declares no optional escape', () => {
      expect(ROUTE_FINGERPRINTS.account.level.keys).toContain('essence');
      expect(ROUTE_FINGERPRINTS.account.level.unread).toContain('fusion_pity');
      expect(ROUTE_FINGERPRINTS.account.level.optional).toBeUndefined();
    });

    it('the /state fixture carries essence as a number, unlike gold, and fusion_pity as item and hero counters', () => {
      if (!bodies) return;
      const stateBody = required(bodies['/state'], 'missing /state body');
      expect(typeof stateBody.essence).toBe('number');
      expect(typeof stateBody.gold).toBe('string');
      expect(Object.keys(stateBody.fusion_pity as object)).toEqual(['item', 'hero']);
    });

    it('a /state body from before the deconstruct screen reports essence missing and fusion_pity absent, path-qualified', () => {
      if (!bodies) return;
      const { essence, fusion_pity, ...preEssence } = required(bodies['/state'], 'missing /state body');
      expect([essence, fusion_pity].every((value) => value !== undefined)).toBe(true);
      expect(checkSchema(preEssence, ROUTE_FINGERPRINTS.account)).toEqual({
        ok: false,
        missingKeys: ['account.essence'],
        addedKeys: [],
        absentUnreadKeys: ['account.fusion_pity'],
      });
    });

    it('an /inventory item from before the deconstruct screen reports the three read keys missing and the odds absent, path-qualified', () => {
      if (!bodies) return;
      const inventory = deepClone(required(bodies['/inventory'], 'missing /inventory body'));
      const items = inventory.items as Record<string, unknown>[];
      for (const key of ITEM_ESSENCE_KEYS) delete items[0]?.[key];
      expect(checkSchema(inventory, ROUTE_FINGERPRINTS.items)).toEqual({
        ok: false,
        missingKeys: ['essence_value', 'forge_fails', 'pergaminho_custo'].map((key) => `items.items[0].${key}`),
        addedKeys: [],
        absentUnreadKeys: ['items.items[0].forge_chance'],
      });
    });

    it('every /inventory fixture item carries all four, with the observed value kinds, and one is a chance stone', () => {
      if (!bodies) return;
      const items = required(bodies['/inventory'], 'missing /inventory body').items as Record<string, unknown>[];
      for (const item of items) {
        expect(typeof item.essence_value, `item ${String(item.id)} essence_value`).toBe('number');
        expect(typeof item.forge_fails).toBe('number');
        expect(typeof item.forge_chance).toBe('number');
        expect(typeof item.pergaminho_custo).toBe('number');
      }
      expect(items.some((item) => item.category === 8)).toBe(true);
    });

    it('jewels and ritual are optional on an item: a row carrying either is not drift, and the fixture carries neither', () => {
      if (!bodies) return;
      const inventory = deepClone(required(bodies['/inventory'], 'missing /inventory body'));
      const items = inventory.items as Record<string, unknown>[];
      expect(items.some((item) => 'jewels' in item || 'ritual' in item)).toBe(false);
      Object.assign(items[0] ?? {}, { jewels: [], ritual: { desconstruir: false, desconstruir_reason: 'ITEM_HAS_GEMS' } });
      expect(checkSchema(inventory, ROUTE_FINGERPRINTS.items)).toEqual({ ok: true, absentUnreadKeys: [] });
    });
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
        absentUnreadKeys: [],
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
        absentUnreadKeys: [],
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
        absentUnreadKeys: [],
      });
    });
  });

  it('api-bodies-after.json is a second WITNESS, not a competing baseline: identical key sets at every declared level', () => {
    if (!afterBodies) return;
    for (const route of ROUTES) {
      const fingerprint = ROUTE_FINGERPRINTS[route.section];
      const body = afterBodies[route.path];
      expect(body, `missing fixture body for ${route.path} in api-bodies-after.json`).toBeDefined();
      // client.test.ts:47 already documents the relationship: "differs from api-bodies.json in
      // exactly five dimensions" — a VALUE twin from the same capture session, not a
      // schema twin. checkSchema only ever inspects key sets, never values, so this passing
      // confirms the key space held stable across the in-game state change between captures.
      expect(checkSchema(body, fingerprint)).toEqual({ ok: true, absentUnreadKeys: [] });
    }
  });

  it('non-vacuity: /roster.heroes, /inventory.items, /rotation.heroes are non-empty in the committed corpus', () => {
    if (!bodies) return;
    const roster = required(bodies['/roster'], 'missing /roster body');
    const inventory = required(bodies['/inventory'], 'missing /inventory body');
    const rotation = required(bodies['/rotation'], 'missing /rotation body');
    expect((roster.heroes as unknown[]).length, 'roster.heroes').toBeGreaterThan(0);
    expect((inventory.items as unknown[]).length, 'inventory.items').toBeGreaterThan(0);
    expect((rotation.heroes as unknown[]).length, 'rotation.heroes').toBeGreaterThan(0);
  });

  it('non-vacuity: item.slot is present on at least one /inventory item and absent on at least one', () => {
    if (!bodies) return;
    const items = required(bodies['/inventory'], 'missing /inventory body').items as Record<string, unknown>[];
    const withSlot = items.filter((item) => 'slot' in item);
    const withoutSlot = items.filter((item) => !('slot' in item));
    expect(withSlot.length, 'items WITH slot').toBeGreaterThan(0);
    expect(withoutSlot.length, 'items WITHOUT slot').toBeGreaterThan(0);
  });

  describe('the forge-patch item fields', () => {
    const forgeFields = { essence_value: 420, forge_fails: 0, forge_chance: 0.15, pergaminho_custo: 12320 };
    const prePatchItem = () => ({
      ...Object.fromEntries(SCHEMA_LEVELS.item.keys.map((key) => [key, 0])),
      equip_slot: 0,
    });
    const inventoryBody = (item: Record<string, unknown>) => ({
      items: [item],
      chests: [],
      bag_tabs: 1,
      bag_capacity: 100,
      items_count: 1,
    });

    it('an item carrying all four reports no drift, on the route and on the section', () => {
      const item = { ...prePatchItem(), ...forgeFields };
      expect(checkSchema(inventoryBody(item), ROUTE_FINGERPRINTS.items)).toEqual({ ok: true, absentUnreadKeys: [] });
      expect(checkSectionShape([item], SECTION_FINGERPRINTS.items)).toEqual({ ok: true, absentUnreadKeys: [] });
    });

    it('an item from before the patch is tolerated on the shared level the save exports use, and reported by the API fingerprints', () => {
      const item = prePatchItem();
      const shared = { ...SECTION_FINGERPRINTS.items, element: SCHEMA_LEVELS.item };
      expect(checkSectionShape([item], shared)).toEqual({ ok: true, absentUnreadKeys: [] });
      expect(checkSectionShape([{ ...item, ...forgeFields }], shared)).toEqual({ ok: true, absentUnreadKeys: [] });
      expect(checkSectionShape([item], SECTION_FINGERPRINTS.items)).toMatchObject({ ok: false });
      expect(checkSchema(inventoryBody(item), ROUTE_FINGERPRINTS.items)).toMatchObject({ ok: false });
    });

    it('an unrelated new key is still reported', () => {
      const item = { ...prePatchItem(), ...forgeFields, brand_new_key: 1 };
      expect(checkSectionShape([item], SECTION_FINGERPRINTS.items)).toMatchObject({ ok: false });
    });
  });

  it('no runtime override exists — no env var and no refresh function name the fingerprint', () => {
    // Mirrors the literal verification command (`git grep -nE
    // 'process\.env\.[A-Z_]*FINGERPRINT|refreshFingerprint' packages/game-api/src`) as an
    // in-suite assertion so it runs on every `pnpm --filter @bombfarm/game-api test`, not only
    // when a human remembers to run the shell command by hand.
    const overridePattern = /process\.env\.[A-Z_]*FINGERPRINT|refreshFingerprint/;
    expect(overridePattern.test(readFileSyncSelf('fingerprints.ts'))).toBe(false);
    expect(overridePattern.test(readFileSyncSelf('shape.ts'))).toBe(false);
    expect(overridePattern.test(readFileSyncSelf('routes.ts'))).toBe(false);
  });

  it('CI=1 fails loudly when the primary corpus artifact is absent', () => {
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

describe('SECTION_FINGERPRINTS — the projected shapes derive from ROUTE_FINGERPRINTS', () => {
  it('account, skills and casa project as identity — their section fingerprint IS their route fingerprint', () => {
    expect(SECTION_FINGERPRINTS.account).toEqual({ kind: 'object', ...ROUTE_FINGERPRINTS.account });
    expect(SECTION_FINGERPRINTS.skills).toEqual({ kind: 'object', ...ROUTE_FINGERPRINTS.skills });
    // `/rotation` used to unwrap to its nested `casa` child only; it now yields its whole body,
    // so `casa` joined `account`/`skills` as an identity projection.
    expect(SECTION_FINGERPRINTS.casa).toEqual({ kind: 'object', ...ROUTE_FINGERPRINTS.casa });
  });

  it('casa: the whole-body level still declares the nested casa child at SCHEMA_LEVELS.casa', () => {
    const routeCasaChild = ROUTE_FINGERPRINTS.casa.level.children?.casa;
    expect(routeCasaChild?.kind).toBe('object');
    if (routeCasaChild?.kind === 'object') {
      expect(routeCasaChild.level).toEqual(SCHEMA_LEVELS.casa);
    }
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
    expect((SECTION_FINGERPRINTS.items as { element: SchemaLevel }).element).toEqual(SCHEMA_LEVELS.apiItem);
  });

  it('checkSectionShape accepts the real committed corpus once projected, for every section', () => {
    if (!bodies) return;
    for (const route of ROUTES) {
      const body = required(bodies[route.path], `missing fixture body for ${route.path}`);
      const projected = route.project(body);
      expect(checkSectionShape(projected, SECTION_FINGERPRINTS[route.section])).toEqual({ ok: true, absentUnreadKeys: [] });
    }
  });

  it('checkSectionShape on an array section names the offending element root[i].key, never root.root[i].key', () => {
    if (!bodies) return;
    const rosterBody = required(bodies['/roster'], 'missing /roster body');
    const heroes = deepClone(rosterBody.heroes as Record<string, unknown>[]);
    const thirdHero = required(heroes[2], 'expected a third roster hero in the committed corpus');
    delete thirdHero.level;
    expect(checkSectionShape(heroes, SECTION_FINGERPRINTS.heroes)).toEqual({
      ok: false,
      missingKeys: ['heroes[2].level'],
      addedKeys: [],
      absentUnreadKeys: [],
    });
  });

  it('checkSectionShape keeps a hero that lost an unread key ok, naming the key at its element', () => {
    if (!bodies) return;
    const rosterBody = required(bodies['/roster'], 'missing /roster body');
    const heroes = deepClone(rosterBody.heroes as Record<string, unknown>[]);
    const thirdHero = required(heroes[2], 'expected a third roster hero in the committed corpus');
    delete thirdHero.in_market;
    expect(checkSectionShape(heroes, SECTION_FINGERPRINTS.heroes)).toEqual({
      ok: true,
      absentUnreadKeys: ['heroes[2].in_market'],
    });
  });
});
