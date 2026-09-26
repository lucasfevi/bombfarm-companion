import { describe, expect, it } from 'vitest';
import { statRollRowsFor } from './birth-roll-panel';
import { highestRollsFor } from './highest-rolls';
import { ZERO_SHEET, heroFixture } from './showcase.test-fixture';

const WINDOW = { min: 0, max: 100 };

const RANGES = {
  attack: WINDOW,
  energy: WINDOW,
  speed: WINDOW,
  luck: WINDOW,
  critChance: WINDOW,
  critDmg: WINDOW,
  penetration: WINDOW,
  cdr: WINDOW,
};

function rolled(birth: Partial<typeof ZERO_SHEET>, ranges: Partial<typeof RANGES> = RANGES) {
  return heroFixture({ id: 'h', birth: { ...ZERO_SHEET, ...birth }, statRanges: ranges });
}

describe('highestRollsFor', () => {
  it('names the two statistics that rolled closest to the top of their window, best first', () => {
    const hero = rolled({ attack: 40, cdr: 97, critDmg: 94, luck: 90 });
    expect(highestRollsFor(hero)).toEqual([
      { key: 'cdr', percentile: 97 },
      { key: 'critDmg', percentile: 94 },
    ]);
  });

  it('reads the same placement the birth-roll panel draws', () => {
    const hero = rolled({ speed: 71, penetration: 88 }, {
      speed: { min: 50, max: 80 },
      penetration: { min: 80, max: 90 },
    });
    const panel = new Map(statRollRowsFor(hero, String, String).map((row) => [row.key, row.percentile]));
    const rolls = highestRollsFor(hero);
    expect(rolls.map((roll) => roll.key)).toEqual(['penetration', 'speed']);
    for (const roll of rolls) expect(roll.percentile).toBe(panel.get(roll.key));
  });

  it('keeps the sheet order between two equal rolls', () => {
    const hero = rolled({ luck: 80, attack: 80, cdr: 80 });
    expect(highestRollsFor(hero).map((roll) => roll.key)).toEqual(['attack', 'luck']);
  });

  it('leaves out a roll outside its own window rather than boasting of the clamp', () => {
    const hero = rolled({ attack: 130, cdr: 60 });
    expect(highestRollsFor(hero, 1)).toEqual([{ key: 'cdr', percentile: 60 }]);
  });

  it('places nothing for a hero without a birth roll', () => {
    expect(highestRollsFor(heroFixture({ id: 'bare' }))).toEqual([]);
  });
});
