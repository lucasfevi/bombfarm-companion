import { describe, expect, it } from 'vitest';
import { extractRosterHeroAbilities } from '@bombfarm/domain/live';

function raw(value: unknown): readonly unknown[] | undefined {
  return value as readonly unknown[] | undefined;
}

describe('extractRosterHeroAbilities — a well-formed roster', () => {
  it('reads every hero id and its code/level pairs, in wire order', () => {
    expect(
      extractRosterHeroAbilities([
        { id: 'perrin', abilities: [{ code: 'folego_mineiro', level: 20 }, { code: 'bateria_extra', level: 7 }] },
        { id: 'sora', abilities: [{ code: 'bateria_extra', level: 3 }] },
      ]),
    ).toEqual([
      { id: 'perrin', abilities: { folego_mineiro: 20, bateria_extra: 7 } },
      { id: 'sora', abilities: { bateria_extra: 3 } },
    ]);
  });

  it('reads nothing but id and abilities — the rest of a wire hero is dropped', () => {
    const [hero] = extractRosterHeroAbilities([
      { id: 'perrin', name: 'Perrin', level: 91, itens: [{ slot: 'arma' }], abilities: [{ code: 'fortuna', level: 1 }] },
    ]);
    expect(Object.keys(hero!)).toEqual(['id', 'abilities']);
  });

  it('keeps the last rank when the wire repeats a code', () => {
    const [hero] = extractRosterHeroAbilities([
      { id: 'perrin', abilities: [{ code: 'fortuna', level: 8 }, { code: 'fortuna', level: 20 }] },
    ]);
    expect(hero!.abilities).toEqual({ fortuna: 20 });
  });

  it('does not alias the wire objects — a later mutation of the input cannot reach the result', () => {
    const wireAbilities = [{ code: 'fortuna', level: 8 }];
    const wireHero = { id: 'perrin', abilities: wireAbilities };
    const [hero] = extractRosterHeroAbilities([wireHero]);
    wireAbilities.push({ code: 'bateria_extra', level: 20 });
    expect(hero!.abilities).toEqual({ fortuna: 8 });
  });
});

describe('extractRosterHeroAbilities — nothing usable on the wire', () => {
  const nonArrays: readonly [string, unknown][] = [
    ['undefined', undefined],
    ['null', null],
    ['an object', { heroes: [] }],
    ['a string', 'perrin'],
    ['a number', 13],
  ];

  for (const [label, value] of nonArrays) {
    it(`is empty when the heroes field is ${label}`, () => {
      expect(extractRosterHeroAbilities(raw(value))).toEqual([]);
    });
  }

  it('is empty for an empty array', () => {
    expect(extractRosterHeroAbilities([])).toEqual([]);
  });
});

describe('extractRosterHeroAbilities — a malformed hero is dropped, and its neighbours are not', () => {
  const unusableHeroes: readonly [string, unknown][] = [
    ['null', null],
    ['a string', 'perrin'],
    ['a number', 13],
    ['an array', [{ code: 'fortuna', level: 1 }]],
    ['a hero with no id', { abilities: [] }],
    ['a hero whose id is a number', { id: 7, abilities: [] }],
    ['a hero whose id is null', { id: null, abilities: [] }],
  ];

  for (const [label, value] of unusableHeroes) {
    it(`drops ${label} and keeps the well-formed heroes either side of it`, () => {
      const kept = extractRosterHeroAbilities([
        { id: 'before', abilities: [{ code: 'fortuna', level: 1 }] },
        value,
        { id: 'after', abilities: [{ code: 'fortuna', level: 2 }] },
      ]);
      expect(kept.map((hero) => hero.id)).toEqual(['before', 'after']);
    });
  }
});

describe('extractRosterHeroAbilities — a hero whose abilities are malformed still has a rank', () => {
  const unusableAbilityBlocks: readonly [string, unknown][] = [
    ['absent', undefined],
    ['null', null],
    ['an object keyed by code', { fortuna: 20 }],
    ['a string', 'fortuna'],
    ['an empty array', []],
  ];

  for (const [label, value] of unusableAbilityBlocks) {
    it(`keeps the hero with no ranks at all when its abilities are ${label}`, () => {
      expect(extractRosterHeroAbilities([{ id: 'perrin', abilities: value }])).toEqual([
        { id: 'perrin', abilities: {} },
      ]);
    });
  }

  const unusableEntries: readonly [string, unknown][] = [
    ['null', null],
    ['a bare string', 'fortuna'],
    ['a number', 20],
    ['missing its code', { level: 20 }],
    ['missing its level', { code: 'fortuna' }],
    ['a numeric code', { code: 7, level: 20 }],
    ['a level sent as a string', { code: 'fortuna', level: '20' }],
    ['a null level', { code: 'fortuna', level: null }],
  ];

  for (const [label, value] of unusableEntries) {
    it(`drops the entry that is ${label} and keeps the usable ones beside it`, () => {
      const [hero] = extractRosterHeroAbilities([
        {
          id: 'perrin',
          abilities: [{ code: 'folego_mineiro', level: 20 }, value, { code: 'bateria_extra', level: 3 }],
        },
      ]);
      expect(hero!.abilities).toEqual({ folego_mineiro: 20, bateria_extra: 3 });
    });
  }
});

describe('extractRosterHeroAbilities — the parse is a shape check, not a range check', () => {
  it('passes a rank of 0 through rather than treating it as absent', () => {
    const [hero] = extractRosterHeroAbilities([{ id: 'perrin', abilities: [{ code: 'fortuna', level: 0 }] }]);
    expect(hero!.abilities).toEqual({ fortuna: 0 });
  });

  it('passes a negative and a non-finite rank through — every consumer owes its own clamp', () => {
    const [hero] = extractRosterHeroAbilities([
      { id: 'perrin', abilities: [{ code: 'fortuna', level: -1 }, { code: 'bateria_extra', level: Number.NaN }] },
    ]);
    expect(hero!.abilities.fortuna).toBe(-1);
    expect(hero!.abilities.bateria_extra).toBeNaN();
  });
});
