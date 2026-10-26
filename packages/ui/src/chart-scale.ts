export type NiceScale = {
  readonly max: number;
  readonly step: number;
  readonly ticks: readonly number[];
};

const STEPS = [1, 2, 2.5, 5, 10] as const;
const WHOLE_STEPS = [1, 2, 5, 10] as const;

/** Tidy away the float dust a step multiple picks up (`0.1 * 3`), so a tick reads as typed. */
function clean(value: number): number {
  return Number(value.toPrecision(12));
}

/**
 * A zero-based axis with round ticks: the step is 1, 2, 2.5 or 5 times a power of ten, and the
 * top is the first multiple of it at or above `max`. `tickCount` is the number of intervals the
 * axis is aimed at, so the result carries about `tickCount + 1` ticks, zero included.
 *
 * With `integerTicks` the step is never below 1 and is always a whole number (1, 2, 5, 10, 20, 50 ...),
 * so a count axis never reads 2.5 or 0.5.
 *
 * A window with nothing above zero has no scale to fit; it gets unit steps so the grid keeps the
 * same shape it has with data and nothing divides by zero.
 */
export function niceScale(max: number, tickCount: number, integerTicks = false): NiceScale {
  const intervals = Math.max(1, Math.floor(tickCount));
  if (!Number.isFinite(max) || max <= 0) {
    return { max: intervals, step: 1, ticks: Array.from({ length: intervals + 1 }, (_, index) => index) };
  }
  const raw = max / intervals;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const steps = integerTicks ? WHOLE_STEPS : STEPS;
  const multiple = steps.find((candidate) => candidate >= raw / magnitude - 1e-9) ?? 10;
  const step = integerTicks ? Math.max(1, clean(multiple * magnitude)) : clean(multiple * magnitude);
  const count = Math.ceil(max / step - 1e-9);
  return {
    max: clean(step * count),
    step,
    ticks: Array.from({ length: count + 1 }, (_, index) => clean(step * index)),
  };
}
