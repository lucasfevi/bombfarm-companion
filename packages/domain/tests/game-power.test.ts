import { describe, expect, it } from 'vitest';
import {
  GAME_POWER_AXES,
  GAME_POWER_FACTOR_IDS,
  GAME_POWER_NEUTRAL_FACTORS,
  alcanceForExplosaoAmpla,
  gamePower,
  gamePowerAxisValue,
  gamePowerCurve,
  gamePowerFactors,
  gamePowerInputOf,
  gamePowerInputWithRunes,
  gamePowerInputWithoutRunes,
  gamePowerMultipliers,
  gamePowerShares,
  withGamePowerAxis,
  type GamePowerInput,
} from '@bombfarm/domain/game-power';
import type { HeroRune } from '@bombfarm/domain/runes';
import { saveSheetUnits } from '@bombfarm/domain/save-units';

type Anchor = {
  readonly label: string;
  readonly explosaoAmpla: number;
  readonly stats: Record<string, number>;
  readonly power: number;
};

/** Export units, and the game's own Power for each sheet. */
const ANCHORS: readonly Anchor[] = [
  {
    label: 'common-naked-energy-below-bomb-clamp',
    explosaoAmpla: 0,
    stats: {
      dmg: 460.363965418838,
      energia: 291.129272558195,
      speed: 57.1883899479584,
      luck: 0.40867335299067,
      crit_chance: 0.0981740844300568,
      crit_dmg: 2.44308042864377,
      penetration: 0.768005134790547,
      cooldown_reduction: 0.00669639228020698,
    },
    power: 4329.61679225725,
  },
  {
    label: 'legendary-pen-above-100-no-ampla',
    explosaoAmpla: 0,
    stats: {
      dmg: 84517.2983212973,
      energia: 5683.49237408955,
      speed: 82.2486330752099,
      luck: 0.802861757070621,
      crit_chance: 0.573817308059583,
      crit_dmg: 9.02764048638362,
      penetration: 108.893359115732,
      cooldown_reduction: 0.137962755505948,
    },
    power: 11256850.9737275,
  },
  {
    label: 'legendary-fast-no-ampla',
    explosaoAmpla: 0,
    stats: {
      dmg: 112165.353512571,
      energia: 6851.88030781265,
      speed: 125.396661332072,
      luck: 0.668610203026932,
      crit_chance: 0.563507577351601,
      crit_dmg: 6.664878955944,
      penetration: 46.8959935995517,
      cooldown_reduction: 0.123828708825335,
    },
    power: 11532961.1391323,
  },
  {
    label: 'legendary-lv1-naked',
    explosaoAmpla: 0,
    stats: {
      dmg: 2532.07200753575,
      energia: 1668.44520542588,
      speed: 63.3622518438296,
      luck: 0.446187785422336,
      crit_chance: 0.115080597406847,
      crit_dmg: 2.79622404849304,
      penetration: 4.43218345801132,
      cooldown_reduction: 0.0287146209624978,
    },
    power: 34632.8845663738,
  },
  {
    label: 'legendary-lv160-ampla20',
    explosaoAmpla: 20,
    stats: {
      dmg: 112044.45492238,
      energia: 10819.5114519185,
      speed: 84.5299927268602,
      luck: 1.07502543417208,
      crit_chance: 0.678503105935927,
      crit_dmg: 10.751104688216,
      penetration: 25.3147485698556,
      cooldown_reduction: 0.0773451554004449,
    },
    power: 28031028.0631238,
  },
  {
    label: 'rare-ampla15-rounds-alcance-up',
    explosaoAmpla: 15,
    stats: {
      dmg: 1565.31109738936,
      energia: 725.825765935685,
      speed: 49.8750868903708,
      luck: 0.164301935933848,
      crit_chance: 0.237453076662183,
      crit_dmg: 2.12171484359405,
      penetration: 9.71862092533005,
      cooldown_reduction: 0.0321829580725741,
    },
    power: 28436.990213478,
  },
];

function inputOf(anchor: Anchor): GamePowerInput {
  return { sheet: saveSheetUnits(anchor.stats), explosaoAmplaLevel: anchor.explosaoAmpla };
}

function anchor(label: string): Anchor {
  const found = ANCHORS.find((entry) => entry.label === label);
  if (!found) throw new Error(`no anchor ${label}`);
  return found;
}

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual / expected - 1);
}

function rune(axis: HeroRune['axis'], strengthPct: number): HeroRune {
  return { axis, strengthPct, playSecondsLeft: 3600, rarity: 0 };
}

/** The skill tree's flat crit-damage add behind the rune witness, in planner percentage points. */
const TREE_CRIT_DMG_PCT = 90.88461522;
const WITNESS_RUNES: readonly HeroRune[] = [rune('crit', 9), rune('critdmg', 9), rune('energy', 5), rune('xp', 9)];
const WITNESS_POWER_WITH_RUNES = 32_411_057.17;

describe('gamePower', () => {
  it.each(ANCHORS.map((entry) => [entry.label, entry] as const))(
    'reproduces the game figure for %s to 1e-9',
    (_label, entry) => {
      expect(relativeError(gamePower(inputOf(entry)), entry.power)).toBeLessThan(1e-9);
    },
  );

  it('rounds Explosão Ampla to whole blocks, half up', () => {
    expect(alcanceForExplosaoAmpla(0)).toBe(1);
    expect(alcanceForExplosaoAmpla(4)).toBe(1);
    expect(alcanceForExplosaoAmpla(5)).toBe(2);
    expect(alcanceForExplosaoAmpla(15)).toBe(3);
    expect(alcanceForExplosaoAmpla(20)).toBe(3);
  });

  it('level 15 is three blocks: two and a half would miss the game figure by exactly 10%', () => {
    const rare = anchor('rare-ampla15-rounds-alcance-up');
    const exact = gamePower(inputOf(rare));
    const rangeFactor = gamePowerFactors(inputOf(rare)).range;
    expect(rangeFactor).toBe(2.5);
    const withTwoAndAHalfBlocks = (exact / rangeFactor) * (1 + 0.5 * 2.5);
    expect(withTwoAndAHalfBlocks / rare.power).toBeCloseTo(0.9, 12);
  });

  it('does not clamp penetration at 100: the hero at 108.9 matches only unclamped', () => {
    const pen = anchor('legendary-pen-above-100-no-ampla');
    const input = inputOf(pen);
    expect(input.sheet.penetration).toBeGreaterThan(100);
    expect(relativeError(gamePower(input), pen.power)).toBeLessThan(1e-9);
    const clamped = gamePower(withGamePowerAxis(input, 'penetration', 100));
    expect(relativeError(clamped, pen.power)).toBeGreaterThan(1e-3);
  });

  it('caps crit chance at 100% inside the crit factor', () => {
    const input = inputOf(anchor('legendary-lv160-ampla20'));
    const atCap = gamePower(withGamePowerAxis(input, 'critChance', 100));
    expect(gamePower(withGamePowerAxis(input, 'critChance', 140))).toBe(atCap);
  });

  it('adds luck and energy inside one utility bracket, and the energy term stops growing at 625', () => {
    const input = inputOf(anchor('legendary-lv1-naked'));
    const utility = gamePowerFactors(input).utility;
    const luck = input.sheet.luck / 100;
    const energyTerm = 0.02 * (Math.min(6, 1 + 0.008 * input.sheet.energy) - 1);
    expect(utility).toBeCloseTo(1 + luck / 2 + energyTerm, 14);
    expect(utility).not.toBeCloseTo((1 + luck / 2) * (1 + energyTerm), 6);
    const at625 = gamePowerFactors(withGamePowerAxis(input, 'energy', 625)).utility;
    const at5000 = gamePowerFactors(withGamePowerAxis(input, 'energy', 5000)).utility;
    expect(at5000).toBe(at625);
  });
});

describe('runes', () => {
  const lv160 = lv160Input();

  it('the rune model reproduces the in-game 32.41M for the rune witness, crit damage before the tree', () => {
    const withRunes = gamePower(gamePowerInputWithRunes(lv160, WITNESS_RUNES, TREE_CRIT_DMG_PCT));
    expect(relativeError(withRunes, WITNESS_POWER_WITH_RUNES)).toBeLessThan(1e-6);
  });

  it('×1.09 on the displayed crit damage instead lands on 32.88M, not the game figure', () => {
    const otherRunes = gamePowerInputWithRunes(lv160, [rune('crit', 9), rune('energy', 5)], TREE_CRIT_DMG_PCT);
    const displayedCritDmg = 1 + lv160.sheet.critDmg / 100;
    const naive = withGamePowerAxis(otherRunes, 'critDmg', (displayedCritDmg * 1.09 - 1) * 100);
    const naivePower = gamePower(naive);
    expect(relativeError(naivePower, WITNESS_POWER_WITH_RUNES)).toBeGreaterThan(1e-2);
    expect(naivePower / 1e6).toBeCloseTo(32.88, 2);
  });

  it('an xp rune moves nothing', () => {
    expect(gamePower(gamePowerInputWithRunes(lv160, [rune('xp', 9)], TREE_CRIT_DMG_PCT))).toBe(gamePower(lv160));
  });

  it('taking the runes back off an observed sheet returns the rune-free figure', () => {
    const observed = gamePowerInputWithRunes(lv160, WITNESS_RUNES, TREE_CRIT_DMG_PCT);
    const stripped = gamePowerInputWithoutRunes(observed, WITNESS_RUNES, TREE_CRIT_DMG_PCT);
    expect(relativeError(gamePower(stripped), anchor('legendary-lv160-ampla20').power)).toBeLessThan(1e-12);
  });
});

describe('gamePowerShares', () => {
  it('neutral factors are a hero with none of each statistic', () => {
    expect(GAME_POWER_NEUTRAL_FACTORS).toEqual({
      crit: 1,
      speed: 0.3,
      energy: 1 - 0.5 / 1.3,
      cooldown: 1,
      range: 1.5,
      penetration: 1,
      utility: 1,
    });
  });

  it.each(ANCHORS.map((entry) => [entry.label, entry] as const))('%s: shares are ≥ 0 and sum to 1', (_label, entry) => {
    const shares = gamePowerShares(inputOf(entry));
    for (const id of GAME_POWER_FACTOR_IDS) expect(shares[id], id).toBeGreaterThanOrEqual(0);
    const total = GAME_POWER_FACTOR_IDS.reduce((sum, id) => sum + shares[id], 0);
    expect(total).toBeCloseTo(1, 12);
  });

  it('the product of the multipliers, times ten times attack, times the neutrals, is Power', () => {
    const input = inputOf(anchor('legendary-fast-no-ampla'));
    const multipliers = gamePowerMultipliers(input);
    let rebuilt = 10 * input.sheet.attack;
    for (const id of GAME_POWER_FACTOR_IDS) rebuilt *= multipliers[id] * GAME_POWER_NEUTRAL_FACTORS[id];
    expect(relativeError(rebuilt, gamePower(input))).toBeLessThan(1e-12);
  });

  it('with runes on, the witness reads crit ×8.80 at a 46.8% share', () => {
    const withRunes = gamePowerInputWithRunes(lv160Input(), WITNESS_RUNES, TREE_CRIT_DMG_PCT);
    expect(gamePowerMultipliers(withRunes).crit).toBeCloseTo(8.8, 2);
    expect(gamePowerShares(withRunes).crit).toBeCloseTo(0.468, 3);
  });

  it('a sheet at neutral everywhere has no stack to share', () => {
    const neutral = withGamePowerAxis(
      { sheet: { ...inputOf(ANCHORS[0]).sheet, critChance: 0, speed: 0, energy: 0, cdr: 0, penetration: 0, luck: 0 }, explosaoAmplaLevel: 0 },
      'attack',
      100,
    );
    const shares = gamePowerShares(neutral);
    for (const id of GAME_POWER_FACTOR_IDS) expect(shares[id]).toBe(0);
  });
});

function lv160Input(): GamePowerInput {
  return inputOf(anchor('legendary-lv160-ampla20'));
}

describe('gamePowerCurve', () => {
  const input = lv160Input();

  it.each(GAME_POWER_AXES.map((axis) => [axis] as const))('%s: passes through the hero at its own value', (axis) => {
    const current = gamePowerAxisValue(input, axis);
    const [point] = gamePowerCurve(input, axis, current, current, 1);
    expect(point.x).toBe(current);
    expect(relativeError(point.power, gamePower(input))).toBeLessThan(1e-12);
  });

  it('spaces n points evenly from lo to hi', () => {
    const points = gamePowerCurve(input, 'speed', 0, 200, 5);
    expect(points.map((point) => point.x)).toEqual([0, 50, 100, 150, 200]);
  });

  it('the crit-damage line at capped crit chance is the curve evaluated with crit chance 100%', () => {
    const capped = gamePowerCurve(withGamePowerAxis(input, 'critChance', 100), 'critDmg', 0, 2000, 11);
    capped.forEach((point) => {
      const direct = gamePower(withGamePowerAxis(withGamePowerAxis(input, 'critDmg', point.x), 'critChance', 100));
      expect(point.power).toBe(direct);
    });
  });
});

describe('gamePowerInputOf', () => {
  it('reads the sheet and the Explosão Ampla level off a hero record', () => {
    const sheet = lv160Input().sheet;
    expect(gamePowerInputOf({ gearedOverride: sheet, abilities: { explosao_ampla: 20, misericordia: 20 } })).toEqual({
      sheet,
      explosaoAmplaLevel: 20,
    });
    expect(gamePowerInputOf({ gearedOverride: sheet, abilities: {} }).explosaoAmplaLevel).toBe(0);
  });
});
