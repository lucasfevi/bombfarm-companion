import type { LiveMap, LiveTick } from '@bombfarm/contracts';

/** The wire reports room health and per-prop health as a byte, `255` meaning full. */
const WIRE_HEALTH_FULL = 255;

export interface MapFoldDeps {
  /** Props a fresh map of this phase spawns. `null` for a phase with no wiki row. */
  readonly propsTotalForPhase: (phase: number) => number | null;
}

/**
 * The live map reading, folded from the tick stream and held as the latest value rather than
 * accumulated: unlike earnings, every figure here describes the present state of the map, so a
 * tick simply replaces the one before it.
 *
 * Each field is carried forward independently when a tick omits it. The stream sends a phase on
 * ticks whose grid is absent and vice versa, and blanking a figure the app still knows because
 * one tick left it out makes the panel flicker between a reading and an em dash.
 */
export class MapFold {
  readonly #deps: MapFoldDeps;
  #lastSequence = -1;
  #phase: number | undefined;
  #healthFraction: number | null = null;
  #propsAlive: number | null = null;

  constructor(deps: MapFoldDeps) {
    this.#deps = deps;
  }

  consumeTick(tick: LiveTick, sequence: number): void {
    if (sequence <= this.#lastSequence) return;
    this.#lastSequence = sequence;

    if (tick.phase !== undefined) this.#phase = tick.phase;
    if (tick.roomHp !== undefined) this.#healthFraction = clampFraction(tick.roomHp / WIRE_HEALTH_FULL);
    if (tick.kinds !== undefined) this.#propsAlive = countPropsAlive(tick.kinds);
  }

  reset(): void {
    this.#lastSequence = -1;
    this.#phase = undefined;
    this.#healthFraction = null;
    this.#propsAlive = null;
  }

  /** `null` until a phase has been reported: every other figure describes a map, and there is
   *  nothing to attach them to before the stream has said which one is being played. */
  get current(): LiveMap | null {
    if (this.#phase === undefined) return null;
    return {
      phase: this.#phase,
      healthFraction: this.#healthFraction,
      propsAlive: this.#propsAlive,
      propsTotal: this.#deps.propsTotalForPhase(this.#phase),
    };
  }
}

/** Occupancy is read from `kinds` alone — see {@link LiveTick.hps} for why the parallel HP array
 *  cannot answer this question. */
function countPropsAlive(kinds: readonly number[]): number {
  let alive = 0;
  for (const kind of kinds) {
    if (kind >= 0) alive += 1;
  }
  return alive;
}

/** The wire has been observed to exceed `255` on the tick a map resets. A fraction above 1 would
 *  render as a health bar overflowing its own track, so it is clamped rather than trusted. */
function clampFraction(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}
