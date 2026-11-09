import type { LiveTick } from '@bombfarm/contracts';

export interface MapEnd {
  /** The wave of the map that ended. */
  readonly wave: number;
  readonly phase: number;
}

/**
 * Notices a map ending in the tick stream: the wave stepping up by exactly one within one phase.
 * Every other change of wave — a phase change, a jump after a reconnect, a counter going back — is
 * not a map this client watched end, so it only moves the baseline.
 *
 * A tick may omit the phase or the wave; each is carried forward on its own, the way the map
 * panel carries them.
 */
export class MapEndWatch {
  #phase: number | undefined;
  #wave: number | undefined;

  observe(tick: LiveTick): MapEnd | null {
    const phase = tick.phase ?? this.#phase;
    if (phase !== this.#phase) {
      this.#phase = phase;
      this.#wave = undefined;
    }
    if (tick.wave === undefined) return null;
    const previousWave = this.#wave;
    this.#wave = tick.wave;
    if (phase === undefined || previousWave === undefined) return null;
    return tick.wave - previousWave === 1 ? { wave: previousWave, phase } : null;
  }

  reset(): void {
    this.#phase = undefined;
    this.#wave = undefined;
  }
}
