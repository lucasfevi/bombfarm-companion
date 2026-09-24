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
import type { SheetKey } from '@bombfarm/domain/planner-constants';
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
  luck: ['luck'],
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

const NICE_MULTIPLIERS = [1, 2, 2.5, 3, 5] as const;
const TICK_STEP_COUNTS = [4, 5, 6] as const;
const MAX_FALLBACK_STEPS = 5;
const TICK_EPSILON = 1e-9;

/** Twelve significant digits: enough for any tick, few enough to drop `lo + i × step` float dust. */
function roundTick(value: number): number {
  return Number(value.toPrecision(12));
}

function isNiceStep(step: number): boolean {
  if (!(step > 0)) return false;
  const magnitude = 10 ** Math.floor(Math.log10(step));
  const mantissa = step / magnitude;
  return NICE_MULTIPLIERS.some((multiplier) => Math.abs(mantissa - multiplier) < 1e-6);
}

function niceStepAtLeast(minimum: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(minimum));
  for (const scale of [1, 10]) {
    for (const multiplier of NICE_MULTIPLIERS) {
      const step = multiplier * magnitude * scale;
      if (step >= minimum - TICK_EPSILON * magnitude) return step;
    }
  }
  return 10 * magnitude;
}

export type NiceAxis = { readonly lo: number; readonly hi: number; readonly ticks: readonly number[] };

/**
 * Ticks for `[lo, hi]` at a nice step (1, 2, 2.5, 3 or 5 × 10ⁿ), both ends among them. A range that
 * 4–6 nice steps already divide keeps its ends; any other is widened out to the next nice step,
 * so a range stretched to reach an odd value still ends on a round number.
 */
export function niceAxis(lo: number, hi: number): NiceAxis {
  const span = hi - lo;
  if (!(span > 0)) return { lo, hi, ticks: [lo] };
  for (const steps of TICK_STEP_COUNTS) {
    const step = span / steps;
    if (isNiceStep(step) && Math.abs(lo / step - Math.round(lo / step)) < 1e-6) {
      return { lo, hi, ticks: Array.from({ length: steps + 1 }, (_, index) => roundTick(lo + index * step)) };
    }
  }
  const step = niceStepAtLeast(span / MAX_FALLBACK_STEPS);
  const niceLo = roundTick(Math.floor(lo / step + TICK_EPSILON) * step);
  const niceHi = roundTick(Math.ceil(hi / step - TICK_EPSILON) * step);
  const steps = Math.round((niceHi - niceLo) / step);
  return {
    lo: niceLo,
    hi: niceHi,
    ticks: Array.from({ length: steps + 1 }, (_, index) => roundTick(niceLo + index * step)),
  };
}

export type PowerAxisSpec = {
  readonly axis: GamePowerAxis;
  readonly lo: number;
  readonly hi: number;
  readonly ticks: readonly number[];
  readonly cap: number | null;
  /** Past this value the curve is drawn dashed and the readout says it is extrapolated. */
  readonly checkedMax: number | null;
  /** Explosão Ampla is a whole level: the guide snaps to integers and the curve is a staircase. */
  readonly integer: boolean;
  /** Crit damage also draws Power as if crit chance sat at its cap. */
  readonly cappedCritLine: boolean;
};

/** The axis always reaches the hero's own value, so the "now" mark is never off the chart. */
/** The pipeline's per-point gain on each sheet key, runes and tree already folded in. */
export type PointDelta = Readonly<Record<SheetKey, number>>;

export const POWER_MARKER_POINTS = [10, 50] as const;

function pointKey(axis: GamePowerAxis): SheetKey | null {
  return axis === 'explosaoAmpla' ? null : axis;
}

/**
 * Where `points` more stat points on this axis would put the hero, uncapped. A point is linear
 * on the sheet — `value + N × delta` equals recomposing the sheet with `pts + N` — so the
 * pipeline's own per-point delta is the whole model. Explosão Ampla is an ability level, not a
 * stat, so it takes no points.
 */
export function valueAfterPoints(
  input: GamePowerInput,
  axis: GamePowerAxis,
  delta: PointDelta | null,
  points: number,
): number | null {
  const key = pointKey(axis);
  if (key === null || delta === null) return null;
  return gamePowerAxisValue(input, axis) + points * delta[key];
}

/** The axis always reaches the hero's own value and its +50-points marker, so neither is off the chart. */
export function powerAxisSpec(
  input: GamePowerInput,
  axis: GamePowerAxis,
  delta: PointDelta | null = null,
): PowerAxisSpec {
  const [fixedLo, fixedHi] =
    axis === 'attack' ? [0, Math.max(1, POWER_ATTACK_RANGE_MULTIPLE * input.sheet.attack)] : FIXED_RANGES[axis];
  const current = gamePowerAxisValue(input, axis);
  const integer = axis === 'explosaoAmpla';
  const cap = CAPS[axis] ?? null;
  const furthest = valueAfterPoints(input, axis, delta, Math.max(...POWER_MARKER_POINTS)) ?? current;
  const reach = cap === null ? furthest : Math.min(furthest, cap);
  const range = niceAxis(
    Math.min(fixedLo, integer ? Math.floor(current) : current),
    Math.max(fixedHi, integer ? Math.ceil(current) : current, reach),
  );
  return {
    axis,
    lo: range.lo,
    hi: range.hi,
    ticks: range.ticks,
    cap,
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
  readonly yTicks: readonly number[];
};

const Y_HEADROOM = 1.02;

function withCappedCritChance(input: GamePowerInput): GamePowerInput {
  return withGamePowerAxis(input, 'critChance', STAT_CAPS.critChance);
}

export function powerChartSeries(input: GamePowerInput, spec: PowerAxisSpec): PowerChartSeries {
  const split = spec.checkedMax !== null && spec.checkedMax < spec.hi ? spec.checkedMax : spec.hi;
  const solid = curveBetween(input, spec, spec.lo, split);
  const extrapolated = split < spec.hi ? curveBetween(input, spec, split, spec.hi) : [];
  const cappedCrit = spec.cappedCritLine ? curveBetween(withCappedCritChance(input), spec, spec.lo, spec.hi) : [];
  const tallest = Math.max(gamePower(input), ...[...solid, ...extrapolated, ...cappedCrit].map((point) => point.power));
  const yAxis = niceAxis(0, tallest > 0 ? tallest * Y_HEADROOM : 1);
  return { solid, extrapolated, cappedCrit, yMax: yAxis.hi, yTicks: yAxis.ticks };
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

export type PowerPointMarker = {
  readonly points: number;
  /** Where the marker is drawn: the value the points reach, or the cap when they pass it. */
  readonly x: number;
  readonly atCap: boolean;
  readonly reading: PowerReading;
};

export function powerPointMarkers(
  input: GamePowerInput,
  spec: PowerAxisSpec,
  delta: PointDelta | null,
): readonly PowerPointMarker[] {
  return POWER_MARKER_POINTS.flatMap((points) => {
    const raw = valueAfterPoints(input, spec.axis, delta, points);
    if (raw === null) return [];
    const atCap = spec.cap !== null && raw > spec.cap;
    const x = atCap && spec.cap !== null ? spec.cap : raw;
    return [{ points, x, atCap, reading: powerReading(input, spec, x) }];
  });
}

export type StripLabel = { readonly id: string; readonly fraction: number; readonly text: string };
export type PlacedStripLabel = StripLabel & { readonly anchor: MarkLabelAnchor };

/**
 * The width assumed before the plot has been measured: narrower than any plot the layout
 * produces, so labels that clear each other here clear each other once measured. The
 * per-character width is generous for the 10px label type.
 */
const UNMEASURED_PLOT_WIDTH_PX = 240;
const LABEL_CHAR_PX = 6.5;
const LABEL_PAD_PX = 4;
const LABEL_GAP_PX = 4;

function labelExtentPx(label: StripLabel, anchor: MarkLabelAnchor, plotWidthPx: number): readonly [number, number] {
  const x = label.fraction * plotWidthPx;
  const width = label.text.length * LABEL_CHAR_PX + LABEL_PAD_PX;
  if (anchor === 'start') return [x, x + width];
  if (anchor === 'end') return [x - width, x];
  return [x - width / 2, x + width / 2];
}

/**
 * The labels in the strip above the plot, in priority order: each is kept only if it clears
 * every label already kept, so the first ("now") always shows and a marker label that would
 * touch it is dropped — the legend under the chart still carries every marker's figures.
 */
export function placeStripLabels(
  labels: readonly StripLabel[],
  plotWidthPx: number | null = null,
): readonly PlacedStripLabel[] {
  const width = plotWidthPx !== null && plotWidthPx > 0 ? plotWidthPx : UNMEASURED_PLOT_WIDTH_PX;
  const placed: { label: PlacedStripLabel; extent: readonly [number, number] }[] = [];
  for (const label of labels) {
    const anchor = markLabelAnchor(label.fraction);
    const extent = labelExtentPx(label, anchor, width);
    const clear = placed.every(
      ({ extent: other }) => extent[0] >= other[1] + LABEL_GAP_PX || other[0] >= extent[1] + LABEL_GAP_PX,
    );
    if (clear) placed.push({ label: { ...label, anchor }, extent });
  }
  return placed.map(({ label }) => label);
}

/** Markers drawn at the same spot — both past the cap, typically — shown as one: "+10 / +50". */
export type PowerMarkerGroup = { readonly marker: PowerPointMarker; readonly label: string };

export function groupCoincidentMarkers(markers: readonly PowerPointMarker[]): readonly PowerMarkerGroup[] {
  const groups: { marker: PowerPointMarker; points: number[] }[] = [];
  for (const marker of markers) {
    const last = groups.at(-1);
    if (last && last.marker.x === marker.x) last.points.push(marker.points);
    else groups.push({ marker, points: [marker.points] });
  }
  return groups.map(({ marker, points }) => ({ marker, label: points.map(String).join(' / +') }));
}

export function powerPointsLegend(markers: readonly PowerPointMarker[], lang: Lang, t: HeroCopy): string {
  return groupCoincidentMarkers(markers)
    .map(({ marker, label }) => {
      const notes = [
        formatPowerDelta(marker.reading, lang).pct,
        ...(marker.atCap ? [t.heroDetailPowerAtCap] : []),
        ...(marker.reading.extrapolated ? [t.heroDetailPowerExtrapolatedNote] : []),
      ];
      return sub(t.heroDetailPowerPointsMarker, {
        points: label,
        power: formatPowerFigure(marker.reading.power),
        change: notes.join(', '),
      });
    })
    .join(' · ');
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

const GAME_TIER = 1000;
const GAME_SUFFIXES = ['', 'k', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud'] as const;

/**
 * Power written the way the game writes it, so the figure reads identically on both screens:
 * thousand-tiers with the game's suffixes, at most two decimals with trailing zeros dropped, and
 * always a dot — the game does not localise this figure.
 */
export function formatPowerFigure(value: number): string {
  const sign = value < 0 ? '-' : '';
  let scaled = Math.abs(value);
  if (scaled < GAME_TIER) return `${sign}${String(Math.round(scaled))}`;
  let tier = 0;
  while (scaled >= GAME_TIER && tier < GAME_SUFFIXES.length - 1) {
    scaled /= GAME_TIER;
    tier += 1;
  }
  const digits = scaled.toFixed(2).replace(/0$/, '').replace(/0$/, '').replace(/\.$/, '');
  return `${sign}${digits}${GAME_SUFFIXES[tier]}`;
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

/** A whole-number tick drops the decimal a readout keeps: `25%`, not `25.0%`. */
export function formatAxisTick(axis: GamePowerAxis, value: number, lang: Lang): string {
  if (!Number.isInteger(value)) return formatAxisValue(axis, value, lang);
  switch (axis) {
    case 'critChance':
    case 'cdr':
    case 'luck':
      return `${formatNumber(value, lang, 0)}%`;
    case 'speed':
    case 'penetration':
      return formatNumber(value, lang, 0);
    default:
      return formatAxisValue(axis, value, lang);
  }
}

function signed(text: string, value: number): string {
  return value < 0 ? `−${text}` : `+${text}`;
}

export function formatPowerDelta(reading: PowerReading, lang: Lang): { delta: string; pct: string } {
  return {
    delta: signed(formatPowerFigure(Math.abs(reading.delta)), reading.delta),
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
    power: formatPowerFigure(reading.power),
    delta,
    pct,
  });
}
