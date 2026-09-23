/**
 * The game's own Power figure ("Poder"), rebuilt from a hero's sheet.
 *
 * Power is a product: `10 × attack` times one factor per statistic. Every constant below was
 * fitted exactly against the game's own power figure — the product reproduces it to float
 * precision. It scores a sheet, nothing else: there is no level term, and team auras do not count.
 *
 * Inputs are planner units (`SheetStats`): percent for crit chance, cooldown and luck, crit damage
 * as the excess over a plain hit in percentage points.
 */
import type { SheetStats } from './gear/types';
import { STAT_CAPS } from './model/rarity-constants';
import { applyRuneMultipliers, runeSheetMultipliers, stripRuneMultipliers, type HeroRune } from './runes';
import type { HeroRecord } from './shims/storage';

export const GAME_POWER_SCALE = 10;
const SPEED_BASE = 0.3;
const SPEED_PER_POINT = 0.12 * 0.0386;
const STAMINA_DEPTH = 0.5;
const STAMINA_BASE = 1.3;
const STAMINA_PER_ENERGY = 0.003;
const MITIGATION = 0.255;
const LUCK_WEIGHT = 0.5;
const ENERGY_UTILITY_WEIGHT = 0.02;
const ENERGY_UTILITY_PER_ENERGY = 0.008;
const ENERGY_UTILITY_CEILING = 6;
const BLOCKS_PER_ALCANCE = 0.5;

/** The highest cooldown reduction the formula has been measured against; past it, it is extrapolated. */
export const GAME_POWER_CDR_OBSERVED_MAX_PCT = 14.3;

export type GamePowerInput = {
  readonly sheet: SheetStats;
  readonly explosaoAmplaLevel: number;
};

/** The factors that carry a share, in display order. Attack is the anchor they multiply and carries none. */
export const GAME_POWER_FACTOR_IDS = ['crit', 'speed', 'range', 'utility', 'energy', 'penetration', 'cooldown'] as const;
export type GamePowerFactorId = (typeof GAME_POWER_FACTOR_IDS)[number];

export type GamePowerFactors = Readonly<Record<GamePowerFactorId, number>> & { readonly attack: number };
export type GamePowerFactorRecord = Readonly<Record<GamePowerFactorId, number>>;

/** Blast reach in whole blocks: the game rounds Explosão Ampla's +0.1 per level, half up. */
export function alcanceForExplosaoAmpla(level: number): number {
  return 1 + Math.round(level / 10);
}

export function gamePowerFactors({ sheet, explosaoAmplaLevel }: GamePowerInput): GamePowerFactors {
  const critChance = Math.min(sheet.critChance, STAT_CAPS.critChance) / 100;
  const energyUtility = Math.min(ENERGY_UTILITY_CEILING, 1 + ENERGY_UTILITY_PER_ENERGY * sheet.energy) - 1;
  return {
    attack: sheet.attack,
    crit: 1 + critChance * (sheet.critDmg / 100),
    speed: SPEED_BASE + SPEED_PER_POINT * sheet.speed,
    energy: 1 - STAMINA_DEPTH / (STAMINA_BASE + STAMINA_PER_ENERGY * sheet.energy),
    cooldown: 1 / (1 - sheet.cdr / 100),
    range: 1 + BLOCKS_PER_ALCANCE * alcanceForExplosaoAmpla(explosaoAmplaLevel),
    // Unclamped, unlike the damage path's mitigation bypass: a sheet past 100 still scores higher.
    penetration: (1 - MITIGATION * (1 - sheet.penetration / 100)) / (1 - MITIGATION),
    utility: 1 + (sheet.luck / 100) * LUCK_WEIGHT + ENERGY_UTILITY_WEIGHT * energyUtility,
  };
}

export function gamePower(input: GamePowerInput): number {
  const factors = gamePowerFactors(input);
  let power = GAME_POWER_SCALE * factors.attack;
  for (const id of GAME_POWER_FACTOR_IDS) power *= factors[id];
  return power;
}

const ZERO_SHEET: SheetStats = {
  attack: 0,
  energy: 0,
  speed: 0,
  critChance: 0,
  critDmg: 0,
  penetration: 0,
  cdr: 0,
  luck: 0,
};

function withoutAttack({ attack: _attack, ...factors }: GamePowerFactors): GamePowerFactorRecord {
  return factors;
}

/** Each factor at a hero with none of its statistic — what a share is measured from. */
export const GAME_POWER_NEUTRAL_FACTORS: GamePowerFactorRecord = withoutAttack(
  gamePowerFactors({ sheet: ZERO_SHEET, explosaoAmplaLevel: 0 }),
);

/** How many times each factor lifts Power over its neutral value. */
export function gamePowerMultipliers(input: GamePowerInput): GamePowerFactorRecord {
  const factors = gamePowerFactors(input);
  const multipliers = {} as Record<GamePowerFactorId, number>;
  for (const id of GAME_POWER_FACTOR_IDS) multipliers[id] = factors[id] / GAME_POWER_NEUTRAL_FACTORS[id];
  return multipliers;
}

/**
 * Each factor's share of the multiplicative stack above neutral, `ln(multiplier) / Σ ln`. Power
 * is a product, so a split only means something against a declared baseline — this one is a hero
 * with none of each statistic. A sheet at neutral everywhere has no stack and every share is 0.
 */
export function gamePowerShares(input: GamePowerInput): GamePowerFactorRecord {
  const multipliers = gamePowerMultipliers(input);
  const logs = GAME_POWER_FACTOR_IDS.map((id) => Math.log(multipliers[id]));
  const total = logs.reduce((sum, value) => sum + value, 0);
  const shares = {} as Record<GamePowerFactorId, number>;
  GAME_POWER_FACTOR_IDS.forEach((id, index) => {
    shares[id] = total > 0 ? logs[index] / total : 0;
  });
  return shares;
}

export const GAME_POWER_AXES = [
  'attack',
  'critChance',
  'critDmg',
  'speed',
  'energy',
  'penetration',
  'cdr',
  'luck',
  'explosaoAmpla',
] as const;
export type GamePowerAxis = (typeof GAME_POWER_AXES)[number];

export function gamePowerAxisValue(input: GamePowerInput, axis: GamePowerAxis): number {
  return axis === 'explosaoAmpla' ? input.explosaoAmplaLevel : input.sheet[axis];
}

export function withGamePowerAxis(input: GamePowerInput, axis: GamePowerAxis, value: number): GamePowerInput {
  if (axis === 'explosaoAmpla') return { ...input, explosaoAmplaLevel: value };
  return { ...input, sheet: { ...input.sheet, [axis]: value } };
}

export type GamePowerPoint = { readonly x: number; readonly power: number };

/** Power at `n` evenly spaced values of one statistic from `lo` to `hi`, every other one held. */
export function gamePowerCurve(
  input: GamePowerInput,
  axis: GamePowerAxis,
  lo: number,
  hi: number,
  n: number,
): GamePowerPoint[] {
  const count = Math.max(1, Math.floor(n));
  const points: GamePowerPoint[] = [];
  for (let index = 0; index < count; index++) {
    const x = index === 0 ? lo : index === count - 1 ? hi : lo + ((hi - lo) * index) / (count - 1);
    points.push({ x, power: gamePower(withGamePowerAxis(input, axis, x)) });
  }
  return points;
}

export function gamePowerInputOf(hero: Pick<HeroRecord, 'gearedOverride' | 'abilities'>): GamePowerInput {
  return { sheet: hero.gearedOverride, explosaoAmplaLevel: hero.abilities.explosao_ampla ?? 0 };
}

/**
 * The sheet with the hero's runes on, through the rune model — crit damage's rune multiplies the
 * excess before the skill tree's flat add (`treeCritDmgPct`, planner percentage points).
 */
export function gamePowerInputWithRunes(
  input: GamePowerInput,
  runes: readonly HeroRune[],
  treeCritDmgPct: number,
): GamePowerInput {
  const sheet = applyRuneMultipliers(input.sheet, { critDmgPct: treeCritDmgPct }, runeSheetMultipliers(runes));
  return { ...input, sheet };
}

/** Exact inverse of {@link gamePowerInputWithRunes}: an observed sheet with its runes taken back off. */
export function gamePowerInputWithoutRunes(
  input: GamePowerInput,
  runes: readonly HeroRune[],
  treeCritDmgPct: number,
): GamePowerInput {
  const sheet = stripRuneMultipliers(input.sheet, { critDmgPct: treeCritDmgPct }, runeSheetMultipliers(runes));
  return { ...input, sheet };
}
