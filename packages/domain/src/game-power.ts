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
import { ABILITIES } from './model/abilities';
import { STAT_CAPS } from './model/rarity-constants';
import { applyRuneMultipliers, runeSheetMultipliers, stripRuneMultipliers, type HeroRune } from './runes';

export const GAME_POWER_SCALE = 10;
const SPEED_BASE = 0.3;
const SPEED_PER_POINT = 0.12 * 0.0386;
const STAMINA_DEPTH = 0.5;
const STAMINA_BASE = 1.3;
const STAMINA_PER_ENERGY = 0.003;
const MITIGATION = 0.255;
const LUCK_WEIGHT = 0.5;
const ENERGY_BRACKET_WEIGHT = 0.02;
const ENERGY_BRACKET_PER_ENERGY = 0.008;
const ENERGY_BRACKET_CEILING = 6;
const BLOCKS_PER_ALCANCE = 0.5;
/**
 * The cells Explosão Ampla adds beyond the core blast hit for half its damage, and Power counts
 * them at that weight — the wiki's `extra_range_frac`. Until the 2026-09-26 patch they counted
 * in full: every level-20 hero's stored Power moved from a reach of 3 to 2 across it.
 */
const EXTRA_CELL_DAMAGE_SHARE = 0.5;

/** The highest cooldown reduction the formula has been checked against; past it, it is extrapolated. */
export const GAME_POWER_CDR_CHECKED_MAX_PCT = 17.85;

export type GamePowerInput = {
  readonly sheet: SheetStats;
  readonly explosaoAmplaLevel: number;
};

/** The factors that carry a share, in display order. Attack is the anchor they multiply and carries none. */
export const GAME_POWER_FACTOR_IDS = ['crit', 'speed', 'range', 'luck', 'energy', 'penetration', 'cooldown'] as const;
export type GamePowerFactorId = (typeof GAME_POWER_FACTOR_IDS)[number];

export type GamePowerFactors = Readonly<Record<GamePowerFactorId, number>> & { readonly attack: number };
export type GamePowerFactorRecord = Readonly<Record<GamePowerFactorId, number>>;

function rangeCellsPerLevel(): number {
  const effect = ABILITIES.find((ability) => ability.id === 'explosao_ampla')?.effect;
  if (effect?.kind !== 'rangeCells') throw new Error('the ability catalog has no Explosão Ampla range effect');
  return effect.perLevel;
}

const RANGE_CELLS_PER_LEVEL = rangeCellsPerLevel();
/**
 * A product meant to land on a whole cell can land just under it (0.29 × 100 is 28.999999999999996),
 * and flooring that would drop the cell. The catalog's 0.1 happens not to, but the rate is data.
 */
const FLOOR_EPSILON = 1e-9;

/**
 * Blast reach in whole cells: the game banks Explosão Ampla's per-level fraction until it makes a
 * full cell, so the reach floors. Heroes at levels between the steps match the game's own Power
 * figure only floored.
 */
export function alcanceForExplosaoAmpla(level: number): number {
  return 1 + Math.floor(RANGE_CELLS_PER_LEVEL * level + FLOOR_EPSILON);
}

/** The reach Power scores: the core cell whole, each cell Explosão Ampla adds at its damage share. */
export function effectiveReachForExplosaoAmpla(level: number): number {
  return 1 + EXTRA_CELL_DAMAGE_SHARE * (alcanceForExplosaoAmpla(level) - 1);
}

type PowerTerms = {
  readonly attack: number;
  readonly crit: number;
  readonly speed: number;
  readonly range: number;
  readonly stamina: number;
  readonly luckTerm: number;
  readonly energyTerm: number;
  readonly penetration: number;
  readonly cooldown: number;
};

function powerTerms({ sheet, explosaoAmplaLevel }: GamePowerInput): PowerTerms {
  const critChance = Math.min(sheet.critChance, STAT_CAPS.critChance) / 100;
  const cdr = Math.min(sheet.cdr, STAT_CAPS.cdr) / 100;
  const bombs = Math.min(ENERGY_BRACKET_CEILING, 1 + ENERGY_BRACKET_PER_ENERGY * sheet.energy);
  return {
    attack: sheet.attack,
    crit: 1 + critChance * (sheet.critDmg / 100),
    speed: SPEED_BASE + SPEED_PER_POINT * sheet.speed,
    range: 1 + BLOCKS_PER_ALCANCE * effectiveReachForExplosaoAmpla(explosaoAmplaLevel),
    stamina: 1 - STAMINA_DEPTH / (STAMINA_BASE + STAMINA_PER_ENERGY * sheet.energy),
    luckTerm: (sheet.luck / 100) * LUCK_WEIGHT,
    energyTerm: ENERGY_BRACKET_WEIGHT * (bombs - 1),
    // Unclamped, unlike the damage path's mitigation bypass: a sheet past 100 still scores higher.
    penetration: (1 - MITIGATION * (1 - sheet.penetration / 100)) / (1 - MITIGATION),
    cooldown: 1 / (1 - cdr),
  };
}

/**
 * The game adds luck and energy inside one bracket, `1 + luck + energy`. It is factored exactly
 * as `(1 + energy) × (1 + luck / (1 + energy))` so each factor moves with one statistic and each
 * row's multiplier matches its own chart; Power itself is computed from the unfactored bracket.
 */
export function gamePowerFactors(input: GamePowerInput): GamePowerFactors {
  const terms = powerTerms(input);
  return {
    attack: terms.attack,
    crit: terms.crit,
    speed: terms.speed,
    range: terms.range,
    luck: 1 + terms.luckTerm / (1 + terms.energyTerm),
    energy: terms.stamina * (1 + terms.energyTerm),
    penetration: terms.penetration,
    cooldown: terms.cooldown,
  };
}

export function gamePower(input: GamePowerInput): number {
  const terms = powerTerms(input);
  const bracket = 1 + terms.luckTerm + terms.energyTerm;
  return (
    GAME_POWER_SCALE *
    terms.attack *
    terms.crit *
    terms.speed *
    terms.range *
    bracket *
    terms.stamina *
    terms.penetration *
    terms.cooldown
  );
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

/**
 * The sheet to score is the one the game shows: composed from birth with gear, the skill tree,
 * the spent points and the runes — the pipeline's `adjusted`, not the zero-points
 * `gearedOverride` a record stores. Team auras never enter it.
 */
export function gamePowerInputOf(
  sheet: SheetStats,
  abilities: Readonly<Record<string, number>> | null | undefined,
): GamePowerInput {
  return { sheet, explosaoAmplaLevel: abilities?.explosao_ampla ?? 0 };
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
