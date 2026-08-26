import { DRAIN_RATE_FLOOR } from '../drain';

/** Same floor `combineDrainRate` already enforces — a derived rate below it, or above the
 *  law's unreduced base of 1, means the measurement is wrong, not the law. */
export const MIN_TRUSTED_DRAIN_RATE = DRAIN_RATE_FLOOR;
export const MAX_TRUSTED_DRAIN_RATE = 1;

export interface HeroEnergyClockState {
  readonly lastEnergy: number | undefined;
  readonly deltaPerFrame: number | undefined;
}

export const EMPTY_HERO_ENERGY_CLOCK: HeroEnergyClockState = {
  lastEnergy: undefined,
  deltaPerFrame: undefined,
};

const RATE_CHANGE_TOLERANCE = 1e-6;

function isRepeatOfCurrentRate(rawDelta: number, deltaPerFrame: number): boolean {
  const frameCount = rawDelta / deltaPerFrame;
  const nearestFrameCount = Math.max(1, Math.round(frameCount));
  return Math.abs(frameCount - nearestFrameCount) <= RATE_CHANGE_TOLERANCE;
}

/**
 * Advances one hero's energy-based clock by a single newly-observed absolute energy reading.
 * `deltaPerFrame` is the hero's own energy drop between two consecutive readings — exact, since
 * the underlying energy is noiseless, and therefore needs no timing input at all.
 *
 * A missed frame reproduces the same per-frame drop scaled by an integer, which reads as a
 * genuine rate change only if two real combined drain rates ever land in an exact integer ratio.
 * The game's own reduction steps combine to a handful of rates between `DRAIN_RATE_FLOOR` and 1
 * roughly a tenth apart, whose pairwise ratios never reach 2 — so treating an integer multiple of
 * the current delta as a skip, and anything else as a new rate, cannot mistake one for the other
 * in either direction: a rate that slows down and one that speeds up both land away from every
 * integer the instant they happen.
 */
export function advanceHeroEnergyClock(state: HeroEnergyClockState, energy: number): HeroEnergyClockState {
  if (state.lastEnergy === undefined) return { lastEnergy: energy, deltaPerFrame: undefined };

  const rawDelta = state.lastEnergy - energy;
  if (rawDelta <= 0) {
    // Energy rose (a recharge) or held flat (idle, or the server's own idle flag): neither is
    // evidence of the drain rate, so tracking restarts from here rather than reporting a zero or
    // negative one.
    return { lastEnergy: energy, deltaPerFrame: undefined };
  }

  if (state.deltaPerFrame !== undefined && isRepeatOfCurrentRate(rawDelta, state.deltaPerFrame)) {
    return { lastEnergy: energy, deltaPerFrame: state.deltaPerFrame };
  }
  return { lastEnergy: energy, deltaPerFrame: rawDelta };
}

/** ~1 minute of frames at the tap's own ~10 Hz cadence — long enough that arrival jitter averages
 *  out to a barely-moving constant, short enough to still track a real change in the tap's own
 *  pacing (a slower machine, a throttled connection) within a session. */
const FRAME_CLOCK_WINDOW_FRAMES = 600;
/** A gap this many times the current estimate is a stall or a resumed session, not the steady
 *  cadence — excluded rather than folded in, so it cannot drag the average. */
const FRAME_CLOCK_OUTLIER_MULTIPLE = 3;
/** Below this many accepted gaps a single jittery arrival could still dominate the average, so
 *  the estimate is not yet reported as measured. */
export const MIN_FRAME_CLOCK_SAMPLES = 8;

export interface FrameClockState {
  readonly lastArrivalMs: number | undefined;
  readonly secondsPerFrame: number | undefined;
  readonly samplesAccepted: number;
}

export const INITIAL_FRAME_CLOCK_STATE: FrameClockState = {
  lastArrivalMs: undefined,
  secondsPerFrame: undefined,
  samplesAccepted: 0,
};

/**
 * Advances the single clock shared by every hero: a running average of the gap between
 * successive frame arrivals. Each new gap is weighted `2 / (min(samplesAccepted, WINDOW) + 1)` —
 * a plain average for the first {@link FRAME_CLOCK_WINDOW_FRAMES} samples so the estimate is
 * usable almost immediately, then a fixed long-time-constant average once warmed up, so a stream
 * that has run a while barely moves per frame and no single arrival's jitter can move it visibly.
 */
export function advanceFrameClock(state: FrameClockState, atMs: number): FrameClockState {
  if (state.lastArrivalMs === undefined) return { ...state, lastArrivalMs: atMs };

  const gapMs = atMs - state.lastArrivalMs;
  if (gapMs <= 0) return { ...state, lastArrivalMs: atMs };

  if (state.secondsPerFrame !== undefined && gapMs > state.secondsPerFrame * 1000 * FRAME_CLOCK_OUTLIER_MULTIPLE) {
    return { ...state, lastArrivalMs: atMs };
  }

  const samplesAccepted = state.samplesAccepted + 1;
  const weight = 2 / (Math.min(samplesAccepted, FRAME_CLOCK_WINDOW_FRAMES) + 1);
  const gapSeconds = gapMs / 1000;
  const secondsPerFrame =
    state.secondsPerFrame === undefined
      ? gapSeconds
      : state.secondsPerFrame + weight * (gapSeconds - state.secondsPerFrame);

  return { lastArrivalMs: atMs, secondsPerFrame, samplesAccepted };
}

/** `undefined` until {@link MIN_FRAME_CLOCK_SAMPLES} gaps have been folded in — before that the
 *  estimate exists but is not yet trustworthy enough for a caller to treat as measured. */
export function measuredSecondsPerFrame(state: FrameClockState): number | undefined {
  return state.samplesAccepted >= MIN_FRAME_CLOCK_SAMPLES ? state.secondsPerFrame : undefined;
}
