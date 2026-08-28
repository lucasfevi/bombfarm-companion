export interface HeroDrainObservation {
  readonly lastEnergy: number | undefined;
  readonly lastAtMs: number | undefined;
}

export const EMPTY_HERO_DRAIN_OBSERVATION: HeroDrainObservation = { lastEnergy: undefined, lastAtMs: undefined };

export interface DrainObservationResult {
  readonly state: HeroDrainObservation;
  readonly observedDrainPerSecond: number | undefined;
}

/**
 * Advances one hero's two-point energy observation and reports the drain rate between the last
 * reading and this one, when the pair is usable evidence of a rate at all: energy must have
 * actually fallen (a rise is a recharge, a flat reading is idle — neither says anything about
 * drain) and real time must have passed. Every frame already carries its own wall-clock arrival
 * time, so this needs no shared clock and no frame-counting to bridge a gap: any two readings,
 * however far apart, give an exact average rate over the interval between them.
 */
export function observeDrainRate(state: HeroDrainObservation, energy: number, atMs: number): DrainObservationResult {
  const nextState: HeroDrainObservation = { lastEnergy: energy, lastAtMs: atMs };
  if (state.lastEnergy === undefined || state.lastAtMs === undefined) {
    return { state: nextState, observedDrainPerSecond: undefined };
  }

  const elapsedSeconds = (atMs - state.lastAtMs) / 1000;
  const energyDrop = state.lastEnergy - energy;
  if (elapsedSeconds <= 0 || energyDrop <= 0) {
    return { state: nextState, observedDrainPerSecond: undefined };
  }
  return { state: nextState, observedDrainPerSecond: energyDrop / elapsedSeconds };
}

/** Relative to the law's own predicted rate. Comfortably above the noise a millisecond-resolution
 *  arrival timestamp and the wire's own energy-fraction precision can introduce between two
 *  adjacent frames, comfortably below the gap a genuinely wrong combination law would produce. */
export const DRAIN_RATE_DISAGREEMENT_MARGIN = 0.05;

export function drainRateDisagrees(observedDrainPerSecond: number, modelledDrainPerSecond: number): boolean {
  return Math.abs(observedDrainPerSecond - modelledDrainPerSecond) / modelledDrainPerSecond > DRAIN_RATE_DISAGREEMENT_MARGIN;
}
