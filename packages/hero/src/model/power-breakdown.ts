/**
 * What the Power panel draws, on top of `@bombfarm/domain/game-power`.
 *
 * Every Power figure here — the rows, the curves, the guide's readout — is a call into that
 * module's `gamePowerCurve` or `gamePower`; nothing re-derives the formula. What lives here is the
 * panel's own judgement: which chart a factor opens, each axis's range and marks, how the guide
 * snaps and steps, and how a value is written.
 */
import {
  GAME_POWER_CDR_CHECKED_MAX_PCT,
  GAME_POWER_FACTOR_IDS,
  gamePower,
  gamePowerAxisValue,
  gamePowerCurve,
  gamePowerMultipliers,
  gamePowerShares,
  withGamePowerAxis,
  type GamePowerAxis,
  type GamePowerFactorId,
  type GamePowerInput,
  type GamePowerPoint,
} from '@bombfarm/domain/game-power';
import { STAT_CAPS } from '@bombfarm/domain/model';
import { formatCompactNumber, formatNumber } from '@bombfarm/ui';
import { sub, type HeroCopy, type Lang } from '../copy';

export type PowerRowId = GamePowerFactorId | 'attack';

export const POWER_ROW_IDS: readonly PowerRowId[] = [...GAME_POWER_FACTOR_IDS, 'attack'];

export type PowerFactorRow = {
  readonly id: PowerRowId;
  readonly multiplier: number | null;
  readonly share: number | null;
};

/**
 * A factor below its neutral value has a negative log-share; the bar cannot draw one, so it shows
 * as zero and the rest are renormalised to fill the bar exactly.
 */
function displayedShares(input: GamePowerInput): Record<GamePowerFactorId, number> {
  const raw = gamePowerShares(input);
  const clamped = {} as Record<GamePowerFactorId, number>;
  let total = 0;
  for (const id of GAME_POWER_FACTOR_IDS) {
    clamped[id] = Math.max(0, raw[id]);
    total += clamped[id];
  }
  if (total > 0) for (const id of GAME_POWER_FACTOR_IDS) clamped[id] /= total;
  return clamped;
}

export function powerFactorRows(input: GamePowerInput): readonly PowerFactorRow[] {
  const multipliers = gamePowerMultipliers(input);
  const shares = displayedShares(input);
  return POWER_ROW_IDS.map((id) =>
    id === 'attack'
      ? { id, multiplier: null, share: null }
      : { id, multiplier: multipliers[id], share: shares[id] },
  );
}

const MISMATCH_DECIMALS = 2;
/** The smallest gap the note can print: anything under half its last digit would read "+0.00%". */
const MATCH_TOLERANCE = (0.5 * 10 ** -MISMATCH_DECIMALS) / 100;

/**
 * How far the panel's rune-free figure sits from the game's stored one, in percent — `null` when
 * they agree or there is no stored figure. They part only where the hero's spent points were
 * recovered approximately.
 */
export function powerMismatchPct(computedRuneFree: number, stored: number | undefined): number | null {
  if (stored === undefined || stored <= 0) return null;
  const relative = computedRuneFree / stored - 1;
  return Math.abs(relative) > MATCH_TOLERANCE ? relative * 100 : null;
}

export function formatSignedPct(pct: number, lang: Lang): string {
  const text = `${formatNumber(Math.abs(pct), lang, MISMATCH_DECIMALS)}%`;
  return pct < 0 ? `−${text}` : `+${text}`;
}

export const POWER_ROW_AXES: Record<PowerRowId, readonly GamePowerAxis[]> = {
  crit: ['critChance', 'critDmg'],
  speed: ['speed'],
  range: ['explosaoAmpla'],
  utility: ['luck'],
  energy: ['energy'],
  penetration: ['penetration'],
  cooldown: ['cdr'],
  attack: ['attack'],
};

/** Attack's chart runs to this multiple of the hero's own attack — every other axis is fixed. */
export const POWER_ATTACK_RANGE_MULTIPLE = 2.2;

const FIXED_RANGES: Record<Exclude<GamePowerAxis, 'attack'>, readonly [number, number]> = {
  critChance: [0, STAT_CAPS.critChance],
  critDmg: [0, 2000],
  speed: [0, 200],
  energy: [0, 12_000],
  penetration: [0, 150],
  cdr: [0, STAT_CAPS.cdr],
  luck: [0, 300],
  explosaoAmpla: [0, 20],
};

const CAPS: Partial<Record<GamePowerAxis, number>> = {
  critChance: STAT_CAPS.critChance,
  cdr: STAT_CAPS.cdr,
};

const CHECKED_MAX: Partial<Record<GamePowerAxis, number>> = {
  cdr: GAME_POWER_CDR_CHECKED_MAX_PCT,
};

export type PowerAxisSpec = {
  readonly axis: GamePowerAxis;
  readonly lo: number;
  readonly hi: number;
  readonly cap: number | null;
  /** Past this value the curve is drawn dashed and the readout says it is extrapolated. */
  readonly checkedMax: number | null;
  /** Explosão Ampla is a whole level: the guide snaps to integers and the curve is a staircase. */
  readonly integer: boolean;
  /** Crit damage also draws Power as if crit chance sat at its cap. */
  readonly cappedCritLine: boolean;
};

/** The axis always reaches the hero's own value, so the "now" mark is never off the chart. */
export function powerAxisSpec(input: GamePowerInput, axis: GamePowerAxis): PowerAxisSpec {
  const [fixedLo, fixedHi] =
    axis === 'attack' ? [0, Math.max(1, POWER_ATTACK_RANGE_MULTIPLE * input.sheet.attack)] : FIXED_RANGES[axis];
  const current = gamePowerAxisValue(input, axis);
  const integer = axis === 'explosaoAmpla';
  return {
    axis,
    lo: Math.min(fixedLo, integer ? Math.floor(current) : current),
    hi: Math.max(fixedHi, integer ? Math.ceil(current) : current),
    cap: CAPS[axis] ?? null,
    checkedMax: CHECKED_MAX[axis] ?? null,
    integer,
    cappedCritLine: axis === 'critDmg',
  };
}

const CURVE_SEGMENTS = 120;

function pointCount(spec: PowerAxisSpec, lo: number, hi: number): number {
  if (spec.integer) return Math.round(hi - lo) + 1;
  return Math.max(2, Math.round((CURVE_SEGMENTS * (hi - lo)) / (spec.hi - spec.lo)) + 1);
}

function curveBetween(input: GamePowerInput, spec: PowerAxisSpec, lo: number, hi: number): GamePowerPoint[] {
  return gamePowerCurve(input, spec.axis, lo, hi, pointCount(spec, lo, hi));
}

export type PowerChartSeries = {
  readonly solid: readonly GamePowerPoint[];
  readonly extrapolated: readonly GamePowerPoint[];
  readonly cappedCrit: readonly GamePowerPoint[];
  readonly yMax: number;
};

const Y_HEADROOM = 1.08;

function withCappedCritChance(input: GamePowerInput): GamePowerInput {
  return withGamePowerAxis(input, 'critChance', STAT_CAPS.critChance);
}

export function powerChartSeries(input: GamePowerInput, spec: PowerAxisSpec): PowerChartSeries {
  const split = spec.checkedMax !== null && spec.checkedMax < spec.hi ? spec.checkedMax : spec.hi;
  const solid = curveBetween(input, spec, spec.lo, split);
  const extrapolated = split < spec.hi ? curveBetween(input, spec, split, spec.hi) : [];
  const cappedCrit = spec.cappedCritLine ? curveBetween(withCappedCritChance(input), spec, spec.lo, spec.hi) : [];
  const tallest = Math.max(gamePower(input), ...[...solid, ...extrapolated, ...cappedCrit].map((point) => point.power));
  return { solid, extrapolated, cappedCrit, yMax: tallest > 0 ? tallest * Y_HEADROOM : 1 };
}

export type PowerReading = {
  readonly x: number;
  readonly power: number;
  readonly delta: number;
  readonly deltaPct: number;
  readonly cappedCritPower: number | null;
  readonly extrapolated: boolean;
};

/** One point of the same curve the chart is drawn with, so the guide reads what the line shows. */
function curvePowerAt(input: GamePowerInput, axis: GamePowerAxis, x: number): number {
  return gamePowerCurve(input, axis, x, x, 1)[0]?.power ?? gamePower(withGamePowerAxis(input, axis, x));
}

export function powerReading(input: GamePowerInput, spec: PowerAxisSpec, x: number): PowerReading {
  const power = curvePowerAt(input, spec.axis, x);
  const now = gamePower(input);
  const delta = power - now;
  return {
    x,
    power,
    delta,
    deltaPct: now > 0 ? (delta / now) * 100 : 0,
    cappedCritPower: spec.cappedCritLine ? curvePowerAt(withCappedCritChance(input), spec.axis, x) : null,
    extrapolated: spec.checkedMax !== null && x > spec.checkedMax,
  };
}

export function clampToAxis(spec: PowerAxisSpec, x: number): number {
  const clamped = Math.min(spec.hi, Math.max(spec.lo, x));
  return spec.integer ? Math.round(clamped) : clamped;
}

/** Where a pointer at `fraction` of the plot's width (0 left, 1 right) puts the guide. */
export function axisValueAtFraction(spec: PowerAxisSpec, fraction: number): number {
  return clampToAxis(spec, spec.lo + fraction * (spec.hi - spec.lo));
}

export function axisFraction(spec: PowerAxisSpec, x: number): number {
  return spec.hi === spec.lo ? 0 : (x - spec.lo) / (spec.hi - spec.lo);
}

export type MarkLabelAnchor = 'start' | 'center' | 'end';

const EDGE_FRACTION = 0.1;

/** A mark near either edge hangs its label inward, so the label stays inside the plot. */
export function markLabelAnchor(fraction: number): MarkLabelAnchor {
  if (fraction < EDGE_FRACTION) return 'start';
  if (fraction > 1 - EDGE_FRACTION) return 'end';
  return 'center';
}

const FINE_STEPS = 100;
const PAGE_MULTIPLE = 10;

export type GuideKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'PageUp' | 'PageDown' | 'Home' | 'End';

const GUIDE_KEYS: ReadonlySet<string> = new Set<GuideKey>([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
]);

export function isGuideKey(key: string): key is GuideKey {
  return GUIDE_KEYS.has(key);
}

/** One arrow press moves the guide a hundredth of the axis, or one level on a whole-level axis. */
export function steppedGuide(spec: PowerAxisSpec, from: number, key: GuideKey): number {
  const step = spec.integer ? 1 : (spec.hi - spec.lo) / FINE_STEPS;
  switch (key) {
    case 'Home':
      return spec.lo;
    case 'End':
      return spec.hi;
    case 'ArrowRight':
    case 'ArrowUp':
      return clampToAxis(spec, from + step);
    case 'ArrowLeft':
    case 'ArrowDown':
      return clampToAxis(spec, from - step);
    case 'PageUp':
      return clampToAxis(spec, from + step * PAGE_MULTIPLE);
    case 'PageDown':
      return clampToAxis(spec, from - step * PAGE_MULTIPLE);
  }
}

/** Two decimals, so the total reads against the game's own abbreviated figure. */
export function formatPowerFigure(value: number, lang: Lang): string {
  return formatCompactNumber(value, lang, 2);
}

export function formatMultiplier(value: number, lang: Lang): string {
  return `×${formatNumber(value, lang, 2)}`;
}

export function formatShare(share: number, lang: Lang): string {
  return `${formatNumber(share * 100, lang, 1)}%`;
}

export function formatAxisValue(axis: GamePowerAxis, value: number, lang: Lang): string {
  switch (axis) {
    case 'critChance':
    case 'cdr':
    case 'luck':
      return `${formatNumber(value, lang, 1)}%`;
    case 'critDmg':
      return `+${formatNumber(value, lang, 0)}%`;
    case 'energy':
      return formatNumber(value, lang, 0);
    case 'speed':
    case 'penetration':
      return formatNumber(value, lang, 1);
    case 'attack':
      return formatCompactNumber(value, lang, 1);
    case 'explosaoAmpla':
      return String(Math.round(value));
  }
}

function signed(text: string, value: number): string {
  return value < 0 ? `−${text}` : `+${text}`;
}

export function formatPowerDelta(reading: PowerReading, lang: Lang): { delta: string; pct: string } {
  return {
    delta: signed(formatPowerFigure(Math.abs(reading.delta), lang), reading.delta),
    pct: signed(`${formatNumber(Math.abs(reading.deltaPct), lang, 1)}%`, reading.deltaPct),
  };
}

export function powerReadoutText(
  reading: PowerReading,
  axisLabel: string,
  spec: PowerAxisSpec,
  lang: Lang,
  t: HeroCopy,
): string {
  const { delta, pct } = formatPowerDelta(reading, lang);
  return sub(t.heroDetailPowerReadout, {
    stat: axisLabel,
    value: formatAxisValue(spec.axis, reading.x, lang),
    power: formatPowerFigure(reading.power, lang),
    delta,
    pct,
  });
}
