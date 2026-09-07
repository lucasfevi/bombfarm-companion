import { describe, expect, it } from 'vitest';
import type { AbilityGain, AbilityGainState } from '@bombfarm/domain/ability-gain';
import { ABILITY_LEVEL_MAX, ABILITY_QUOTA } from '@bombfarm/domain/model';
import { ZERO_PTS_TEMPLATE } from '@bombfarm/domain/planner-constants';
import { heroLevelLabel } from '@bombfarm/domain/game-labels';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import {
  abilityPanelAvailability,
  abilityPointReadoutFor,
  abilityRowsFor,
  abilitySlotReadoutFor,
  abilityValueText,
  deadPointNote,
  type AbilityRowText,
  type AbilityValueCopy,
} from './ability-panel';

const VALUE_COPY: AbilityValueCopy = {
  gain: (gainPct) => `worth ${gainPct.toFixed(2)}%`,
  maxed: 'already at maximum',
  notModelled: 'not modelled',
  auraAtCeiling: 'the team is already at this aura ceiling',
  notMeasured: 'this effect lands outside what damage per second measures',
  unavailable: 'this hero cannot be valued',
};

const ROW_TEXT: AbilityRowText = {
  level: (level, max) => `${heroLevelLabel(level, 'en')} of ${String(max)}`,
  value: VALUE_COPY,
};

const EVERY_STATE: readonly AbilityGainState[] = [
  { kind: 'gain', gainPct: 1.5 },
  { kind: 'maxed' },
  { kind: 'notModelled' },
  { kind: 'auraAtCeiling' },
  { kind: 'notMeasured' },
  { kind: 'unavailable', reason: 'no-birth-roll' },
];

function gainOf(abilityId: string, state: AbilityGainState, level = 3, max = 20): AbilityGain {
  return { abilityId, level, max, state };
}

function hero(fields: Partial<HeroRecord>): HeroRecord {
  return {
    id: 'hero-1',
    name: 'Hero',
    updatedAt: 0,
    rarity: 'Comum',
    level: 10,
    stars: 0,
    naked: { ...ZERO_PTS_TEMPLATE },
    loadout: {},
    altLoadout: null,
    gearedOverride: { ...ZERO_PTS_TEMPLATE },
    abilities: {},
    pts: { ...ZERO_PTS_TEMPLATE },
    ...fields,
  };
}

describe('abilityValueText', () => {
  it('states each of the six gain states as its own sentence', () => {
    const rendered = EVERY_STATE.map((state) => abilityValueText(state, VALUE_COPY));
    expect(new Set(rendered).size).toBe(EVERY_STATE.length);
  });

  it('never renders a state as a blank', () => {
    for (const state of EVERY_STATE) {
      expect(abilityValueText(state, VALUE_COPY).trim(), state.kind).not.toBe('');
    }
  });

  it('states an unmeasured effect as unmeasured, never as a gain of zero', () => {
    const rendered = abilityValueText({ kind: 'notMeasured' }, VALUE_COPY);
    expect(rendered).toBe(VALUE_COPY.notMeasured);
    expect(rendered).not.toContain('0');
    expect(rendered).not.toBe(abilityValueText({ kind: 'gain', gainPct: 0 }, VALUE_COPY));
  });

  it('tells an aura already at its ceiling apart from an ability the model does not carry', () => {
    expect(abilityValueText({ kind: 'auraAtCeiling' }, VALUE_COPY)).not.toBe(
      abilityValueText({ kind: 'notModelled' }, VALUE_COPY),
    );
  });

  it('tells a hero that cannot be valued apart from one whose ability is maxed', () => {
    expect(
      abilityValueText({ kind: 'unavailable', reason: 'no-birth-roll' }, VALUE_COPY),
    ).not.toBe(abilityValueText({ kind: 'maxed' }, VALUE_COPY));
  });

  it('carries the priced gain through to the sentence', () => {
    expect(abilityValueText({ kind: 'gain', gainPct: 2.25 }, VALUE_COPY)).toBe('worth 2.25%');
  });
});

describe('abilityRowsFor', () => {
  it('keeps one row per slot, unspent level-0 slots included', () => {
    const rows = abilityRowsFor(
      [
        gainOf('grito_guerra', { kind: 'gain', gainPct: 1 }, 4),
        gainOf('veia_ouro', { kind: 'notModelled' }, 0),
      ],
      ROW_TEXT,
    );
    expect(rows.map((row) => row.abilityId)).toEqual(['grito_guerra', 'veia_ouro']);
    expect(rows.map((row) => row.spent)).toEqual([true, false]);
  });

  it('labels a level with the game’s level abbreviation, never the hero’s grade word', () => {
    const [row] = abilityRowsFor([gainOf('olho_clinico', { kind: 'maxed' }, 20)], ROW_TEXT);
    expect(row.levelText).toBe('Lv 20 of 20');
    expect(row.levelText.toLowerCase()).not.toContain('rank');
  });

  it('marks the abilities that land on the hero’s own statistic sheet', () => {
    const rows = abilityRowsFor(
      [
        gainOf('olho_clinico', { kind: 'gain', gainPct: 1 }),
        gainOf('grito_guerra', { kind: 'gain', gainPct: 1 }),
      ],
      ROW_TEXT,
    );
    expect(rows.map((row) => row.onSheet)).toEqual([true, false]);
  });

  it('reports the arm each row’s sentence came from', () => {
    const rows = abilityRowsFor(
      EVERY_STATE.map((state, index) => gainOf(`ability-${String(index)}`, state)),
      ROW_TEXT,
    );
    expect(rows.map((row) => row.reading)).toEqual([
      'gain',
      'maxed',
      'notModelled',
      'auraAtCeiling',
      'notMeasured',
      'unavailable',
    ]);
  });
});

describe('abilityPanelAvailability', () => {
  it('a hero owning no abilities is unavailable with a named reason', () => {
    expect(abilityPanelAvailability([])).toEqual({ kind: 'unavailable', reason: 'noAbilities' });
  });

  it('one slot is enough to draw the list', () => {
    expect(abilityPanelAvailability([gainOf('grito_guerra', { kind: 'maxed' }, 20)])).toEqual({
      kind: 'available',
    });
  });
});

describe('abilitySlotReadoutFor', () => {
  it('counts the pool against the rarity quota', () => {
    const readout = abilitySlotReadoutFor(
      hero({ rarity: 'Raro', abilities: { grito_guerra: 4, veia_ouro: 0 } }),
    );
    expect(readout).toEqual({ used: 2, quota: ABILITY_QUOTA.Raro, full: false });
  });

  it('a pool at its quota reads as full', () => {
    const readout = abilitySlotReadoutFor(hero({ rarity: 'Comum', abilities: { fortuna: 1 } }));
    expect(readout).toEqual({ used: 1, quota: 1, full: true });
  });
});

describe('abilityPointReadoutFor', () => {
  it('a hero below its slot ceiling has no dead points and is not at the ceiling either', () => {
    const readout = abilityPointReadoutFor(
      hero({ rarity: 'Comum', level: 12, abilities: { grito_guerra: 5 } }),
    );
    expect(readout).toEqual({
      granted: 12,
      spendable: 12,
      spent: 5,
      dead: { kind: 'none', count: 0 },
    });
  });

  it('a hero exactly on its ceiling is told apart from one below it, though both waste nothing', () => {
    const ceiling = ABILITY_QUOTA.Comum * ABILITY_LEVEL_MAX;
    const readout = abilityPointReadoutFor(hero({ rarity: 'Comum', level: ceiling }));
    expect(readout.dead).toEqual({ kind: 'atCeiling', count: 0 });
    expect(readout.spendable).toBe(ceiling);
  });

  it('a hero past its ceiling carries the difference as points it can never spend', () => {
    const readout = abilityPointReadoutFor(
      hero({ rarity: 'Comum', level: ABILITY_QUOTA.Comum * ABILITY_LEVEL_MAX + 9 }),
    );
    expect(readout.dead).toEqual({ kind: 'dead', count: 9 });
    expect(readout.spendable).toBe(ABILITY_QUOTA.Comum * ABILITY_LEVEL_MAX);
  });

  it('sums the levels actually spent across the pool', () => {
    const readout = abilityPointReadoutFor(
      hero({ rarity: 'Épico', level: 40, abilities: { grito_guerra: 7, olho_clinico: 3, veia_ouro: 0 } }),
    );
    expect(readout.spent).toBe(10);
    expect(readout.granted).toBe(40);
  });
});

describe('deadPointNote', () => {
  const NOTES = {
    none: 'every level still buys a point',
    atCeiling: 'this hero has reached what its slots can hold',
    dead: (count: number) => `${String(count)} points can never be used`,
  };

  it('gives the three readings three different sentences', () => {
    const rendered = [
      deadPointNote({ kind: 'none', count: 0 }, NOTES),
      deadPointNote({ kind: 'atCeiling', count: 0 }, NOTES),
      deadPointNote({ kind: 'dead', count: 9 }, NOTES),
    ];
    expect(new Set(rendered).size).toBe(3);
    expect(rendered[2]).toContain('9');
  });

  it('never returns a blank', () => {
    for (const reading of [
      { kind: 'none', count: 0 },
      { kind: 'atCeiling', count: 0 },
      { kind: 'dead', count: 1 },
    ] as const) {
      expect(deadPointNote(reading, NOTES).trim(), reading.kind).not.toBe('');
    }
  });
});
