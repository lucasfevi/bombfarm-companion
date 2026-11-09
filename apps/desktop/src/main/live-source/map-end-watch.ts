import type { LiveTick } from '@bombfarm/contracts';

export interface MapEnd {
  /** The wave of the map that ended. */
  readonly wave: number;
  /** The phase that map was played on — the frame's before the step, since advancing to the next
   *  phase ends a map too. */
  readonly phase: number;
}

/**
 * Notices a map ending in the tick stream: the wave stepping up by exactly one between two frames
 * that each name a map (a phase and a wave, neither negative), whether or not the phase changed.
 * A frame naming no map leaves the baseline alone; a jump of more than one or a counter going back
 * only moves it.
 */
export class MapEndWatch {
  #last: MapEnd | null = null;

  observe(tick: LiveTick): MapEnd | null {
    const { phase, wave } = tick;
    if (phase === undefined || wave === undefined || phase < 0 || wave < 0) return null;
    const previous = this.#last;
    this.#last = { wave, phase };
    return previous !== null && wave - previous.wave === 1 ? previous : null;
  }

  reset(): void {
    this.#last = null;
  }
}
