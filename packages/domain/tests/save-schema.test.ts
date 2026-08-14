import { describe, expect, it } from 'vitest';
import {
  assertNonEmptyCorpusArray,
  assertOptionalKeyWitnessedBothWays,
  checkSchema,
  SCHEMA_LEVELS,
  type SchemaFingerprint,
  type SchemaLevel,
} from '../src/save-schema.js';

/** Minimal fingerprint builder — gameBuild/capturedAt/sourceArtifact are irrelevant to the engine. */
function fingerprint(root: string, level: SchemaLevel): SchemaFingerprint {
  return { root, level, gameBuild: 'test-build', capturedAt: '2026-01-01T00:00:00.000Z', sourceArtifact: 'test' };
}

/** A valid `skills.totals` body built from the exported level's own key list (engine test only —
 * MSG-10's "written down as literals" applies to the T4/T5 corpus checks, not this generic
 * mechanics suite). */
function validSkillsTotals(): Record<string, number> {
  return Object.fromEntries(SCHEMA_LEVELS.skillsTotals.keys.map((key) => [key, 1]));
}

function validSkills(): Record<string, unknown> {
  return {
    levels: { E01: 5 },
    refunds: { E01: 2 },
    field_slots: 3,
    bag_tabs: 1,
    gold: 100,
    max_phase: 5,
    totals: validSkillsTotals(),
  };
}

function validHero(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const base = Object.fromEntries(SCHEMA_LEVELS.hero.keys.map((key) => [key, 'value']));
  return { ...base, ...overrides };
}

function validItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const base = Object.fromEntries(SCHEMA_LEVELS.item.keys.map((key) => [key, 'value']));
  return { ...base, slot: 'weapon', ...overrides };
}

function validCasa(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    active_casa: 1,
    levels: [1, 2, 3, 4, 5],
    cycle_secs: 60,
    slots: 9,
    slots_per_house: [3, 6, 9, 9, 9],
    cycle_secs_per_house: [60, 60, 60, 60, 60],
    upgrade_cost: [100],
    ...overrides,
  };
}

describe('checkSchema — the declared-path engine (MSG-01…MSG-07)', () => {
  it('returns exactly {ok:true} with no missingKeys/addedKeys property on a matching body', () => {
    const result = checkSchema(validSkills(), fingerprint('skills', SCHEMA_LEVELS.skills));
    expect(result).toEqual({ ok: true });
    expect(result).not.toHaveProperty('missingKeys');
    expect(result).not.toHaveProperty('addedKeys');
  });

  it('a removed TOP-LEVEL key is reported as a missing, path-qualified key', () => {
    const body = validSkills();
    delete body.gold;
    const result = checkSchema(body, fingerprint('skills', SCHEMA_LEVELS.skills));
    expect(result).toEqual({ ok: false, missingKeys: ['skills.gold'], addedKeys: [] });
  });

  it('a removed NESTED key is reported path-qualified (MSG-01) — skills.totals.vagas_campo', () => {
    const body = validSkills();
    const totals = body.totals as Record<string, unknown>;
    delete totals.vagas_campo;
    const result = checkSchema(body, fingerprint('skills', SCHEMA_LEVELS.skills));
    expect(result).toEqual({ ok: false, missingKeys: ['skills.totals.vagas_campo'], addedKeys: [] });
  });

  it('an added TOP-LEVEL key is fatal, demonstrated separately from the nested case (MSG-02, MSG-03)', () => {
    const body = { ...validSkills(), something_new: 1 };
    const result = checkSchema(body, fingerprint('skills', SCHEMA_LEVELS.skills));
    expect(result).toEqual({ ok: false, missingKeys: [], addedKeys: ['skills.something_new'] });
  });

  it('an added NESTED key is fatal, path-qualified (MSG-02)', () => {
    const body = validSkills();
    (body.totals as Record<string, unknown>).something_new = 1;
    const result = checkSchema(body, fingerprint('skills', SCHEMA_LEVELS.skills));
    expect(result).toEqual({ ok: false, missingKeys: [], addedKeys: ['skills.totals.something_new'] });
  });

  it('no {ok:true} result can carry an added key — a body with both a missing and an added key reports both, ok:false', () => {
    const body = validSkills();
    delete body.gold;
    (body.totals as Record<string, unknown>).extra = 1;
    const result = checkSchema(body, fingerprint('skills', SCHEMA_LEVELS.skills));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missingKeys).toEqual(['skills.gold']);
      expect(result.addedKeys).toEqual(['skills.totals.extra']);
    }
  });

  it('exact-key model: an allowance key and an optional key are never reported added; anything else is (MSG-04)', () => {
    const level: SchemaLevel = { keys: ['a'], optional: ['b'], allowance: ['c'] };
    const okBody = checkSchema({ a: 1, b: 2, c: 3 }, fingerprint('root', level));
    expect(okBody).toEqual({ ok: true });

    const noOptionalOrAllowance = checkSchema({ a: 1 }, fingerprint('root', level));
    expect(noOptionalOrAllowance).toEqual({ ok: true });

    const trulyAdded = checkSchema({ a: 1, d: 4 }, fingerprint('root', level));
    expect(trulyAdded).toEqual({ ok: false, missingKeys: [], addedKeys: ['root.d'] });
  });

  it('there is no wildcard or prefix escape — a key sharing a prefix with a declared key is still added', () => {
    const level: SchemaLevel = { keys: ['totals'] };
    const result = checkSchema({ totals: 1, totalsExtra: 2 }, fingerprint('root', level));
    expect(result).toEqual({ ok: false, missingKeys: [], addedKeys: ['root.totalsExtra'] });
  });

  it('descent only via a declared children entry — an undeclared nested object is invisible to the engine', () => {
    const level: SchemaLevel = { keys: ['nested'] };
    // `nested` is a declared KEY but not a declared CHILD — its internal shape is never checked.
    const result = checkSchema({ nested: { anything: 'goes', here: true } }, fingerprint('root', level));
    expect(result).toEqual({ ok: true });
  });

  it('declared value map (MSG-07): added/removed entries inside stay ok — only presence + container kind matter', () => {
    const emptied = validSkills();
    emptied.levels = {};
    emptied.refunds = { newEntry: 1, anotherEntry: 2 };
    const result = checkSchema(emptied, fingerprint('skills', SCHEMA_LEVELS.skills));
    expect(result).toEqual({ ok: true });
  });

  it('declared value list: added/removed elements stay ok — only presence + container kind matter', () => {
    const body = validCasa({ levels: [1], slots_per_house: [1, 2, 3, 4, 5, 6, 7] });
    const result = checkSchema(body, fingerprint('casa', SCHEMA_LEVELS.casa));
    expect(result).toEqual({ ok: true });
  });

  it.each([
    ['null', null],
    ['a number', 42],
    ['an array', ['not', 'an', 'object']],
  ])('a declared OBJECT child present but %s is reported missing at its own path, not descended, no throw', (_label, value) => {
    const body = validSkills();
    body.totals = value;
    expect(() => checkSchema(body, fingerprint('skills', SCHEMA_LEVELS.skills))).not.toThrow();
    const result = checkSchema(body, fingerprint('skills', SCHEMA_LEVELS.skills));
    expect(result).toEqual({ ok: false, missingKeys: ['skills.totals'], addedKeys: [] });
  });

  it('a declared VALUE MAP child present but not an object (wrong container kind) is reported missing, not descended', () => {
    const body = validSkills();
    body.levels = ['not', 'a', 'map'];
    const result = checkSchema(body, fingerprint('skills', SCHEMA_LEVELS.skills));
    expect(result).toEqual({ ok: false, missingKeys: ['skills.levels'], addedKeys: [] });
  });

  it('a declared VALUE LIST child present but not an array (wrong container kind) is reported missing, not descended', () => {
    const body = validCasa({ levels: { not: 'a list' } });
    const result = checkSchema(body, fingerprint('casa', SCHEMA_LEVELS.casa));
    expect(result).toEqual({ ok: false, missingKeys: ['casa.levels'], addedKeys: [] });
  });

  it('a declared ARRAY child present but not an array (wrong container kind) is reported missing, not descended', () => {
    const level: SchemaLevel = {
      keys: ['heroes'],
      children: { heroes: { kind: 'array', element: SCHEMA_LEVELS.hero } },
    };
    const result = checkSchema({ heroes: 'not-an-array' }, fingerprint('root', level));
    expect(result).toEqual({ ok: false, missingKeys: ['root.heroes'], addedKeys: [] });
  });

  it('non-object body reports the root path as missing — never throws (edge case: valid JSON, not an object)', () => {
    const level: SchemaLevel = { keys: ['a'] };
    for (const value of [null, 42, 'string', [1, 2, 3], true]) {
      expect(() => checkSchema(value, fingerprint('root', level))).not.toThrow();
      expect(checkSchema(value, fingerprint('root', level))).toEqual({
        ok: false,
        missingKeys: ['root'],
        addedKeys: [],
      });
    }
  });

  it('a declared nested path ABSENT ENTIRELY is reported missing at its parent level, not "nothing to descend into"', () => {
    const body = validSkills();
    delete body.totals;
    const result = checkSchema(body, fingerprint('skills', SCHEMA_LEVELS.skills));
    expect(result).toEqual({ ok: false, missingKeys: ['skills.totals'], addedKeys: [] });
  });

  it.each([0, false, null, []])('a key present with value %s counts as PRESENT, never missing', (falsyValue) => {
    const level: SchemaLevel = { keys: ['a'] };
    const result = checkSchema({ a: falsyValue }, fingerprint('root', level));
    expect(result).toEqual({ ok: true });
  });

  it('every element of a declared array is checked, indexed root.path[i].key (MSG-06)', () => {
    const level: SchemaLevel = {
      keys: ['heroes'],
      children: { heroes: { kind: 'array', element: SCHEMA_LEVELS.hero } },
    };
    const goodHero = validHero();
    const badHero = validHero();
    delete badHero.in_market;
    const result = checkSchema({ heroes: [goodHero, badHero] }, fingerprint('root', level));
    expect(result).toEqual({ ok: false, missingKeys: ['root.heroes[1].in_market'], addedKeys: [] });
  });

  it('a heterogeneous array names the offending element by index even when other elements agree', () => {
    const level: SchemaLevel = {
      keys: ['heroes'],
      children: { heroes: { kind: 'array', element: SCHEMA_LEVELS.hero } },
    };
    const heroes = [validHero(), validHero(), { ...validHero(), extra_field: 1 }];
    const result = checkSchema({ heroes }, fingerprint('root', level));
    expect(result).toEqual({ ok: false, missingKeys: [], addedKeys: ['root.heroes[2].extra_field'] });
  });
});

describe('assertNonEmptyCorpusArray — MSG-06 anti-vacuity #1', () => {
  it('throws, naming the path, when the array is empty', () => {
    expect(() => assertNonEmptyCorpusArray([], 'save.heroes')).toThrow(/save\.heroes/);
  });

  it('does not throw when the array has at least one element', () => {
    expect(() => assertNonEmptyCorpusArray([{}], 'save.heroes')).not.toThrow();
  });
});

describe('assertOptionalKeyWitnessedBothWays — AD-087 anti-vacuity #2', () => {
  it('throws when the key is never present in the corpus (dead optional)', () => {
    const elements = [{ a: 1 }, { a: 2 }];
    expect(() => assertOptionalKeyWitnessedBothWays(elements, 'slot', 'save.items')).toThrow(/never present/);
  });

  it('throws when the key is never absent in the corpus (vacuous optional)', () => {
    const elements = [{ a: 1, slot: 'x' }, { a: 2, slot: 'y' }];
    expect(() => assertOptionalKeyWitnessedBothWays(elements, 'slot', 'save.items')).toThrow(/never absent/);
  });

  it('does not throw when both a carrying and a lacking element exist', () => {
    const elements = [{ a: 1, slot: 'x' }, { a: 2 }];
    expect(() => assertOptionalKeyWitnessedBothWays(elements, 'slot', 'save.items')).not.toThrow();
  });
});

describe('SCHEMA_LEVELS — the shared catalogue (design §2.3), key sets written as literals', () => {
  it('skills: the measured 7-key set, with totals/levels/refunds declared as children', () => {
    expect(SCHEMA_LEVELS.skills.keys).toEqual([
      'levels',
      'refunds',
      'field_slots',
      'bag_tabs',
      'gold',
      'max_phase',
      'totals',
    ]);
    expect(SCHEMA_LEVELS.skills.children?.totals).toEqual({ kind: 'object', level: SCHEMA_LEVELS.skillsTotals });
    expect(SCHEMA_LEVELS.skills.children?.levels).toEqual({ kind: 'valueMap' });
    expect(SCHEMA_LEVELS.skills.children?.refunds).toEqual({ kind: 'valueMap' });
  });

  it('skillsTotals: the measured 12-key post-patch set, written down as a literal', () => {
    // The absence of any retired-vocabulary token in this set is enforced separately and
    // structurally by packages/domain/tests/source-surface.test.ts's hard zero over this
    // package — that guard's own pattern is not repeated here.
    expect(SCHEMA_LEVELS.skillsTotals.keys).toEqual([
      'team_dmg_add',
      'crit_chance_add',
      'crit_dmg_add',
      'speed_add',
      'coin_add',
      'luck_add',
      'energia_add',
      'xp_mult',
      'geo_mult',
      'dmg_static',
      'vagas_campo',
      'bag_tabs_bonus',
    ]);
  });

  it('hero: the measured 23-key set, with no `children` (value-shaped fields are not descended)', () => {
    expect(SCHEMA_LEVELS.hero.keys).toHaveLength(23);
    expect(SCHEMA_LEVELS.hero.keys).toEqual(
      expect.arrayContaining(['in_market', 'ability_reroll_cost', 'ability_reroll_stone']),
    );
    expect(SCHEMA_LEVELS.hero.children).toBeUndefined();
  });

  it('item: the measured 17-key set with the enumerated optional escape `slot` (27/3 API split, 17/5 export split)', () => {
    expect(SCHEMA_LEVELS.item.keys).toHaveLength(17);
    expect(SCHEMA_LEVELS.item.optional).toEqual(['slot']);
  });

  it('casa: the measured 7-key set with 4 value-list children (house-indexed arrays)', () => {
    expect(SCHEMA_LEVELS.casa.keys).toHaveLength(7);
    expect(SCHEMA_LEVELS.casa.children).toEqual({
      levels: { kind: 'valueList' },
      slots_per_house: { kind: 'valueList' },
      cycle_secs_per_house: { kind: 'valueList' },
      upgrade_cost: { kind: 'valueList' },
    });
  });

  it('a fully-populated synthetic body composing all five levels checks ok:true end to end', () => {
    const level: SchemaLevel = {
      keys: ['skills', 'heroes', 'items', 'casa'],
      children: {
        skills: { kind: 'object', level: SCHEMA_LEVELS.skills },
        heroes: { kind: 'array', element: SCHEMA_LEVELS.hero },
        items: { kind: 'array', element: SCHEMA_LEVELS.item },
        casa: { kind: 'object', level: SCHEMA_LEVELS.casa },
      },
    };
    const itemWithoutSlot = validItem();
    delete itemWithoutSlot.slot;
    const body = {
      skills: validSkills(),
      heroes: [validHero(), validHero()],
      items: [validItem(), itemWithoutSlot],
      casa: validCasa(),
    };
    expect(checkSchema(body, fingerprint('save', level))).toEqual({ ok: true });
  });
});
