import { describe, expect, it } from 'vitest';
import type { HouseSnapshot, RotationHeroSnapshot, RotationSnapshot } from '@bombfarm/contracts';
import { ROUTE_FINGERPRINTS } from '../fingerprints.js';
import { loadFixtureJson, required } from '../test-fixtures.js';
import { normalizeRotation } from './normalize.js';

const bodies = loadFixtureJson('api-bodies.json');
const rotationBody = required(bodies['/rotation'], 'no /rotation fixture body');
const rosterSection = required(bodies['/roster'], 'no /roster fixture body');
const rosterHeroes = rosterSection['heroes'];

const baselineResult = normalizeRotation(rotationBody, rosterHeroes);
const baseline: RotationSnapshot = baselineResult.snapshot;

// --- Declared key sets, read from the fingerprint this feature must not modify (fingerprints.ts
// is settled from an earlier commit on this branch) — never hand-listed, so a future added wire
// key is picked up by the categorization checks below instead of silently going untested. ------

const rotationFingerprint = ROUTE_FINGERPRINTS.casa;
const rootKeys = rotationFingerprint.level.keys;

const heroesChild = rotationFingerprint.level.children?.['heroes'];
if (heroesChild?.kind !== 'array') {
  throw new Error('rotation fingerprint "heroes" child is no longer declared as an array — update this sweep');
}
const heroKeys = heroesChild.element.keys;

const casaChild = rotationFingerprint.level.children?.['casa'];
if (casaChild?.kind !== 'object') {
  throw new Error('rotation fingerprint "casa" child is no longer declared as an object — update this sweep');
}
const houseKeys = casaChild.level.keys;

// --- Mutators over cloned fixture JSON ---------------------------------------------------------

function withRootKeyDeleted(key: string): Record<string, unknown> {
  const clone = structuredClone(rotationBody);
  Reflect.deleteProperty(clone, key);
  return clone;
}

function withRootKeySet(key: string, value: unknown): Record<string, unknown> {
  const clone = structuredClone(rotationBody);
  clone[key] = value;
  return clone;
}

function withHeroKeyDeleted(heroIndex: number, key: string): Record<string, unknown> {
  const clone = structuredClone(rotationBody);
  const heroes = clone['heroes'] as Record<string, unknown>[];
  Reflect.deleteProperty(required(heroes[heroIndex], `no fixture hero at index ${String(heroIndex)}`), key);
  return clone;
}

function withHeroKeySet(heroIndex: number, key: string, value: unknown): Record<string, unknown> {
  const clone = structuredClone(rotationBody);
  const heroes = clone['heroes'] as Record<string, unknown>[];
  required(heroes[heroIndex], `no fixture hero at index ${String(heroIndex)}`)[key] = value;
  return clone;
}

function withHeroPatch(heroIndex: number, patch: Record<string, unknown>): Record<string, unknown> {
  const clone = structuredClone(rotationBody);
  const heroes = clone['heroes'] as Record<string, unknown>[];
  heroes[heroIndex] = { ...required(heroes[heroIndex], `no fixture hero at index ${String(heroIndex)}`), ...patch };
  return clone;
}

function withHouseKeyDeleted(key: string): Record<string, unknown> {
  const clone = structuredClone(rotationBody);
  const house = clone['casa'] as Record<string, unknown>;
  Reflect.deleteProperty(house, key);
  return clone;
}

function withHouseKeySet(key: string, value: unknown): Record<string, unknown> {
  const clone = structuredClone(rotationBody);
  const house = clone['casa'] as Record<string, unknown>;
  house[key] = value;
  return clone;
}

// --- Expected-snapshot builders: baseline with exactly one datum removed, by domain field ------

function omitRootScalar(snapshot: RotationSnapshot, wireField: string): RotationSnapshot {
  switch (wireField) {
    case 'field_size': {
      const { fieldSize: _fieldSize, ...rest } = snapshot;
      return rest;
    }
    case 'rescues_left': {
      const { rescuesLeft: _rescuesLeft, ...rest } = snapshot;
      return rest;
    }
    case 'rescues_max': {
      const { rescuesMax: _rescuesMax, ...rest } = snapshot;
      return rest;
    }
    default:
      throw new Error(`no root-scalar remover declared for wire key "${wireField}"`);
  }
}

function removeHeroDomainField(hero: RotationHeroSnapshot, wireField: string): RotationHeroSnapshot {
  switch (wireField) {
    case 'level': {
      const { level: _level, ...rest } = hero;
      return rest;
    }
    case 'energia_atual': {
      const { energy: _energy, ...rest } = hero;
      return rest;
    }
    case 'energia_max': {
      const { energyMax: _energyMax, ...rest } = hero;
      return rest;
    }
    case 'energia_pct': {
      const { energyFraction: _energyFraction, ...rest } = hero;
      return rest;
    }
    case 'state': {
      const { activity: _activity, ...rest } = hero;
      return rest;
    }
    case 'in_field': {
      const { onField: _onField, ...rest } = hero;
      return rest;
    }
    case 'in_casa': {
      const { inHouse: _inHouse, ...rest } = hero;
      return rest;
    }
    case 'recovering': {
      const { recovering: _recovering, ...rest } = hero;
      return rest;
    }
    case 'battle_allowed': {
      const { battleAllowed: _battleAllowed, ...rest } = hero;
      return rest;
    }
    default:
      throw new Error(`no hero-field remover declared for wire key "${wireField}"`);
  }
}

function omitHeroField(snapshot: RotationSnapshot, heroIndex: number, wireField: string): RotationSnapshot {
  return {
    ...snapshot,
    heroes: snapshot.heroes.map((hero, index) => (index === heroIndex ? removeHeroDomainField(hero, wireField) : hero)),
  };
}

function removeHouseDomainField(house: HouseSnapshot, wireField: string): HouseSnapshot {
  switch (wireField) {
    case 'active_casa': {
      const { activeHouseIndex: _activeHouseIndex, ...rest } = house;
      return rest;
    }
    case 'levels': {
      const { houseLevels: _houseLevels, ...rest } = house;
      return rest;
    }
    case 'cycle_secs': {
      const { cycleSeconds: _cycleSeconds, ...rest } = house;
      return rest;
    }
    case 'slots': {
      const { slots: _slots, ...rest } = house;
      return rest;
    }
    case 'slots_per_house': {
      const { slotsPerHouse: _slotsPerHouse, ...rest } = house;
      return rest;
    }
    case 'cycle_secs_per_house': {
      const { cycleSecondsPerHouse: _cycleSecondsPerHouse, ...rest } = house;
      return rest;
    }
    case 'upgrade_cost': {
      const { upgradeCost: _upgradeCost, ...rest } = house;
      return rest;
    }
    default:
      throw new Error(`no house-field remover declared for wire key "${wireField}"`);
  }
}

function omitHouseField(snapshot: RotationSnapshot, wireField: string): RotationSnapshot {
  const house = required(snapshot.house, 'baseline snapshot has no house');
  return { ...snapshot, house: removeHouseDomainField(house, wireField) };
}

// --- Invalid-value mutants, one per declared field. A field with no entry here throws instead of
// silently skipping, so a newly declared wire key fails loudly rather than going untested. -------

const INVALID_VALUES: Readonly<Record<string, unknown>> = {
  field_size: -1,
  rescues_left: -3,
  rescues_max: -3,
  id: '',
  level: -1,
  energia_atual: -5,
  energia_max: -5,
  energia_pct: 1.5,
  state: 'UNKNOWN_STATE',
  in_field: 'yes',
  in_casa: 'yes',
  recovering: 'yes',
  battle_allowed: 'yes',
  active_casa: 999,
  levels: 'not-an-array',
  cycle_secs: 0,
  slots: -1,
  slots_per_house: 'not-an-array',
  cycle_secs_per_house: 'not-an-array',
  upgrade_cost: 'not-an-array',
};

function invalidValueFor(wireField: string): unknown {
  if (!Object.hasOwn(INVALID_VALUES, wireField)) {
    throw new Error(`no invalid-value mutant declared for wire key "${wireField}" — add one to INVALID_VALUES`);
  }
  return INVALID_VALUES[wireField];
}

describe('normalizeRotation — the unmutated fixture', () => {
  it('produces zero drops', () => {
    expect(baselineResult.drops).toEqual([]);
  });
});

describe('roster join', () => {
  it('all 8 fixture heroes resolve with a name and grade from /roster', () => {
    expect(baseline.heroes).toHaveLength(8);
    for (const hero of baseline.heroes) {
      expect(hero.name, `hero ${hero.id} should have a name from /roster`).toBeDefined();
      expect(hero.grade, `hero ${hero.id} should have a grade from /roster`).toBeDefined();
    }
  });

  it('a hero with no matching /roster entry resolves with an absent name/grade, an unchanged id, and no drop event', () => {
    const rosterArray = rosterHeroes as ReadonlyArray<Record<string, unknown>>;
    const trimmedRoster = rosterArray.filter((entry) => entry['id'] !== '555');
    const result = normalizeRotation(rotationBody, trimmedRoster);
    expect(result.drops).toEqual([]);
    const hero = required(
      result.snapshot.heroes.find((candidate) => candidate.id === '555'),
      'hero 555 missing from snapshot',
    );
    expect(hero.id).toBe('555');
    expect(hero.name).toBeUndefined();
    expect(hero.grade).toBeUndefined();
  });
});

describe('edge cases', () => {
  it('body is not a plain object (and not undefined) → empty snapshot, one drop naming the root as wrong_type', () => {
    const result = normalizeRotation('not-an-object', rosterHeroes);
    expect(result.snapshot).toEqual({ heroes: [] });
    expect(result.drops).toEqual([{ path: '(root)', reason: 'wrong_type' }]);
  });

  it('body is undefined → empty snapshot, one drop naming the root as missing', () => {
    const result = normalizeRotation(undefined, rosterHeroes);
    expect(result.snapshot).toEqual({ heroes: [] });
    expect(result.drops).toEqual([{ path: '(root)', reason: 'missing' }]);
  });

  it('heroes present but empty → zero heroes, not a failure, no drop event', () => {
    const result = normalizeRotation(withRootKeySet('heroes', []), rosterHeroes);
    expect(result.snapshot.heroes).toEqual([]);
    expect(result.drops).toEqual([]);
  });

  it('energia_atual > energia_max with a present, valid energia_pct → keeps the wire fraction as-is, no drop', () => {
    const result = normalizeRotation(withHeroKeySet(0, 'energia_atual', 999), rosterHeroes);
    const hero = required(
      result.snapshot.heroes.find((candidate) => candidate.id === '555'),
      'hero 555 missing from snapshot',
    );
    expect(hero.energy).toBe(999);
    expect(hero.energyMax).toBe(238.63487669725936);
    expect(hero.energyFraction).toBe(0.6967926613616499);
    expect(result.drops.filter((drop) => drop.path.startsWith('heroes[0]'))).toEqual([]);
  });

  it('out-of-range energia_pct with energia_atual > energia_max → clamps the fraction to 1.0, no drop', () => {
    const result = normalizeRotation(
      withHeroPatch(0, { energia_atual: 999, energia_pct: 1.5 }),
      rosterHeroes,
    );
    const hero = required(
      result.snapshot.heroes.find((candidate) => candidate.id === '555'),
      'hero 555 missing from snapshot',
    );
    expect(hero.energy).toBe(999);
    expect(hero.energyMax).toBe(238.63487669725936);
    expect(hero.energyFraction).toBe(1);
    expect(result.drops.filter((drop) => drop.path.startsWith('heroes[0]'))).toEqual([]);
  });

  it('out-of-range energia_pct with energia_atual within max → drops the fraction, absent from the snapshot', () => {
    const result = normalizeRotation(withHeroKeySet(0, 'energia_pct', 1.5), rosterHeroes);
    const hero = required(
      result.snapshot.heroes.find((candidate) => candidate.id === '555'),
      'hero 555 missing from snapshot',
    );
    expect(hero.energyFraction).toBeUndefined();
    expect(result.drops).toEqual([{ path: 'heroes[0].energia_pct', reason: 'out_of_range' }]);
  });

  it('missing energia_pct with energia_atual > energia_max → drops the fraction, absent regardless of the energy/max relationship', () => {
    const clone = withHeroKeyDeleted(0, 'energia_pct');
    const heroes = clone['heroes'] as Record<string, unknown>[];
    required(heroes[0], 'no fixture hero at index 0').energia_atual = 999;
    const result = normalizeRotation(clone, rosterHeroes);
    const hero = required(
      result.snapshot.heroes.find((candidate) => candidate.id === '555'),
      'hero 555 missing from snapshot',
    );
    expect(hero.energy).toBe(999);
    expect(hero.energyFraction).toBeUndefined();
    expect(result.drops).toEqual([{ path: 'heroes[0].energia_pct', reason: 'missing' }]);
  });

  it('wrong-typed energia_pct with energia_atual > energia_max → drops the fraction, absent regardless of the energy/max relationship', () => {
    const result = normalizeRotation(
      withHeroPatch(0, { energia_atual: 999, energia_pct: 'lots' }),
      rosterHeroes,
    );
    const hero = required(
      result.snapshot.heroes.find((candidate) => candidate.id === '555'),
      'hero 555 missing from snapshot',
    );
    expect(hero.energy).toBe(999);
    expect(hero.energyFraction).toBeUndefined();
    expect(result.drops).toEqual([{ path: 'heroes[0].energia_pct', reason: 'wrong_type' }]);
  });

  it('energia_max === 0 → no division by zero, no Infinity, no NaN anywhere in the snapshot', () => {
    const result = normalizeRotation(withHeroPatch(0, { energia_atual: 0, energia_max: 0 }), rosterHeroes);
    const hero = required(
      result.snapshot.heroes.find((candidate) => candidate.id === '555'),
      'hero 555 missing from snapshot',
    );
    expect(hero.energy).toBe(0);
    expect(hero.energyMax).toBe(0);
    for (const candidate of result.snapshot.heroes) {
      if (candidate.energy !== undefined) expect(Number.isFinite(candidate.energy)).toBe(true);
      if (candidate.energyMax !== undefined) expect(Number.isFinite(candidate.energyMax)).toBe(true);
      if (candidate.energyFraction !== undefined) expect(Number.isFinite(candidate.energyFraction)).toBe(true);
    }
  });

  it('rescues_left > rescues_max → drops rescues_left, keeps rescues_max', () => {
    const result = normalizeRotation(withRootKeySet('rescues_left', 999), rosterHeroes);
    expect(result.snapshot.rescuesLeft).toBeUndefined();
    expect(result.snapshot.rescuesMax).toBe(15);
    expect(result.drops).toEqual([{ path: 'rescues_left', reason: 'out_of_range' }]);
  });

  it('active_casa indexing outside levels[] → activeHouseIndex absent, hero data unaffected', () => {
    const result = normalizeRotation(withHouseKeySet('active_casa', 999), rosterHeroes);
    expect(result.snapshot.house?.activeHouseIndex).toBeUndefined();
    expect(result.snapshot.heroes).toEqual(baseline.heroes);
    expect(result.drops).toEqual([{ path: 'casa.active_casa', reason: 'out_of_range' }]);
  });

  it('cycle_secs above the plausibility ceiling is dropped — catches a seconds→milliseconds unit change', () => {
    const asMilliseconds = 1190.5263157894735 * 1000;
    const result = normalizeRotation(withHouseKeySet('cycle_secs', asMilliseconds), rosterHeroes);
    expect(result.snapshot.house?.cycleSeconds).toBeUndefined();
    expect(result.drops).toEqual([{ path: 'casa.cycle_secs', reason: 'out_of_range' }]);
  });

  it('a duplicate hero id keeps the first, drops the second, with exactly one drop event', () => {
    const clone = structuredClone(rotationBody);
    const heroes = clone['heroes'] as Record<string, unknown>[];
    const duplicate = { ...required(heroes[1], 'no fixture hero at index 1') };
    duplicate['id'] = '555';
    heroes.push(duplicate);

    const result = normalizeRotation(clone, rosterHeroes);
    expect(result.snapshot.heroes).toHaveLength(8);
    expect(result.snapshot.heroes[0]?.id).toBe('555');
    expect(result.drops).toEqual([{ path: 'heroes[8].id', reason: 'duplicate' }]);
  });

  it('a missing energia_max on one hero costs only its energy ceiling — id, level and state survive', () => {
    const result = normalizeRotation(withHeroKeyDeleted(0, 'energia_max'), rosterHeroes);
    const hero = required(
      result.snapshot.heroes.find((candidate) => candidate.id === '555'),
      'hero 555 missing from snapshot',
    );
    expect(hero.energyMax).toBeUndefined();
    expect(hero.id).toBe('555');
    expect(hero.level).toBe(25);
    expect(hero.activity).toBe('resting');
    expect(result.drops).toEqual([{ path: 'heroes[0].energia_max', reason: 'missing' }]);
  });

  it('a missing casa.cycle_secs costs only the cycle time — heroes, house identity and rescues survive', () => {
    const result = normalizeRotation(withHouseKeyDeleted('cycle_secs'), rosterHeroes);
    expect(result.snapshot.house?.cycleSeconds).toBeUndefined();
    expect(result.snapshot.heroes).toEqual(baseline.heroes);
    expect(result.snapshot.house?.activeHouseIndex).toBe(baseline.house?.activeHouseIndex);
    expect(result.snapshot.house?.houseLevels).toEqual(baseline.house?.houseLevels);
    expect(result.snapshot.rescuesLeft).toBe(baseline.rescuesLeft);
    expect(result.snapshot.rescuesMax).toBe(baseline.rescuesMax);
    expect(result.drops).toEqual([{ path: 'casa.cycle_secs', reason: 'missing' }]);
  });

  it('never treats energia_atual as a number of seconds — energy passes through unchanged, undivided', () => {
    const result = normalizeRotation(withHeroKeySet(0, 'energia_atual', 1_234_567), rosterHeroes);
    const hero = required(
      result.snapshot.heroes.find((candidate) => candidate.id === '555'),
      'hero 555 missing from snapshot',
    );
    // A conversion through any plausible drain rate (packages/domain's combineDrainRate range,
    // 0.6-1.0 energy/s) would move this value; it does not.
    expect(hero.energy).toBe(1_234_567);
  });
});

describe('hero id — the only non-optional hero field', () => {
  it('a missing id drops the whole hero, one drop event', () => {
    const result = normalizeRotation(withHeroKeyDeleted(0, 'id'), rosterHeroes);
    expect(result.snapshot.heroes).toHaveLength(7);
    expect(result.snapshot).toEqual({ ...baseline, heroes: baseline.heroes.filter((hero) => hero.id !== '555') });
    expect(result.drops).toEqual([{ path: 'heroes[0].id', reason: 'missing' }]);
  });

  it('an unusable (empty string) id drops the whole hero, one drop event', () => {
    const result = normalizeRotation(withHeroKeySet(0, 'id', ''), rosterHeroes);
    expect(result.snapshot.heroes).toHaveLength(7);
    expect(result.snapshot).toEqual({ ...baseline, heroes: baseline.heroes.filter((hero) => hero.id !== '555') });
    expect(result.drops).toEqual([{ path: 'heroes[0].id', reason: 'out_of_range' }]);
  });
});

// --- The mutation sweep: every OTHER declared /rotation wire key gets a delete mutant and an
// invalid-value mutant, asserting the rest of the snapshot is untouched and exactly one drop
// event names the field. -------------------------------------------------------------------------

const ROOT_SCALAR_KEYS = ['field_size', 'rescues_left', 'rescues_max'];
const ROOT_COMPOSITE_KEYS = ['heroes', 'casa'];
const HERO_SCALAR_KEYS = [
  'level',
  'energia_atual',
  'energia_max',
  'energia_pct',
  'state',
  'in_field',
  'in_casa',
  'recovering',
  'battle_allowed',
];

describe('declared key coverage — a future added key must be categorized here or this fails', () => {
  it('root-level keys are exactly the scalar + composite sets', () => {
    expect(new Set(rootKeys)).toEqual(new Set([...ROOT_SCALAR_KEYS, ...ROOT_COMPOSITE_KEYS]));
  });

  it('hero-level keys are exactly "id" + the scalar set', () => {
    expect(new Set(heroKeys)).toEqual(new Set(['id', ...HERO_SCALAR_KEYS]));
  });
});

describe.each(ROOT_SCALAR_KEYS)('mutation sweep — root scalar field "%s"', (key) => {
  it('delete mutant drops exactly this field, rest unaffected', () => {
    const result = normalizeRotation(withRootKeyDeleted(key), rosterHeroes);
    expect(result.drops).toEqual([{ path: key, reason: 'missing' }]);
    expect(result.snapshot).toEqual(omitRootScalar(baseline, key));
  });

  it('invalid-value mutant drops exactly this field, rest unaffected', () => {
    const result = normalizeRotation(withRootKeySet(key, invalidValueFor(key)), rosterHeroes);
    expect(result.drops).toHaveLength(1);
    const drop = required(result.drops[0], 'expected exactly one drop event');
    expect(drop.path).toBe(key);
    expect(['wrong_type', 'out_of_range']).toContain(drop.reason);
    expect(result.snapshot).toEqual(omitRootScalar(baseline, key));
  });
});

describe('mutation sweep — root composite field "heroes"', () => {
  it('delete mutant drops exactly heroes, rest unaffected', () => {
    const result = normalizeRotation(withRootKeyDeleted('heroes'), rosterHeroes);
    expect(result.drops).toEqual([{ path: 'heroes', reason: 'missing' }]);
    expect(result.snapshot).toEqual({ ...baseline, heroes: [] });
  });

  it('invalid-value mutant drops exactly heroes, rest unaffected', () => {
    const result = normalizeRotation(withRootKeySet('heroes', 'not-an-array'), rosterHeroes);
    expect(result.drops).toEqual([{ path: 'heroes', reason: 'wrong_type' }]);
    expect(result.snapshot).toEqual({ ...baseline, heroes: [] });
  });
});

describe('mutation sweep — root composite field "casa" (house)', () => {
  it('delete mutant drops exactly the house, rest unaffected', () => {
    const result = normalizeRotation(withRootKeyDeleted('casa'), rosterHeroes);
    expect(result.drops).toEqual([{ path: 'casa', reason: 'missing' }]);
    const { house: _house, ...rest } = baseline;
    expect(result.snapshot).toEqual(rest);
  });

  it('invalid-value mutant drops exactly the house, rest unaffected', () => {
    const result = normalizeRotation(withRootKeySet('casa', 'not-an-object'), rosterHeroes);
    expect(result.drops).toEqual([{ path: 'casa', reason: 'wrong_type' }]);
    const { house: _house, ...rest } = baseline;
    expect(result.snapshot).toEqual(rest);
  });
});

describe.each(HERO_SCALAR_KEYS)('mutation sweep — hero field "%s" (hero index 0)', (key) => {
  const path = `heroes[0].${key}`;

  it('delete mutant drops exactly this field, rest unaffected', () => {
    const result = normalizeRotation(withHeroKeyDeleted(0, key), rosterHeroes);
    expect(result.drops).toEqual([{ path, reason: 'missing' }]);
    expect(result.snapshot).toEqual(omitHeroField(baseline, 0, key));
  });

  it('invalid-value mutant drops exactly this field, rest unaffected', () => {
    const result = normalizeRotation(withHeroKeySet(0, key, invalidValueFor(key)), rosterHeroes);
    expect(result.drops).toHaveLength(1);
    const drop = required(result.drops[0], 'expected exactly one drop event');
    expect(drop.path).toBe(path);
    expect(['wrong_type', 'out_of_range']).toContain(drop.reason);
    expect(result.snapshot).toEqual(omitHeroField(baseline, 0, key));
  });
});

describe.each(houseKeys)('mutation sweep — house field "%s"', (key) => {
  const path = `casa.${key}`;

  it('delete mutant drops exactly this field, rest unaffected', () => {
    const result = normalizeRotation(withHouseKeyDeleted(key), rosterHeroes);
    expect(result.drops).toEqual([{ path, reason: 'missing' }]);
    expect(result.snapshot).toEqual(omitHouseField(baseline, key));
  });

  it('invalid-value mutant drops exactly this field, rest unaffected', () => {
    const result = normalizeRotation(withHouseKeySet(key, invalidValueFor(key)), rosterHeroes);
    expect(result.drops).toHaveLength(1);
    const drop = required(result.drops[0], 'expected exactly one drop event');
    expect(drop.path).toBe(path);
    expect(['wrong_type', 'out_of_range']).toContain(drop.reason);
    expect(result.snapshot).toEqual(omitHouseField(baseline, key));
  });
});
