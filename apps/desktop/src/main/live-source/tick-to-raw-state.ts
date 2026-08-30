import type { LiveTick, RawGameState } from '@bombfarm/contracts';

/**
 * `t`, `kinds`, and `hps` are stubbed rather than forwarded. `classifyGameState` requires all
 * three only because it was written to validate the game's own raw JSON shape, and nothing
 * downstream of `buildSnapshot` reads their contents — so the stubs exist purely to pass that
 * check, and copying the real arrays across would be per-tick work no consumer on this path
 * benefits from.
 *
 * They are not absent from the wire: the combat stream carries `kinds` and `hps` on every tick,
 * and {@link LiveTick} decodes both. Anything that needs the real grid should read the tick
 * directly (`map-fold.ts` does) rather than reaching for the empty arrays below.
 */
export function tickToRawGameState(tick: LiveTick): RawGameState | null {
  if (tick.gold === undefined) return null;
  return {
    t: 'snap',
    gold: tick.gold,
    kinds: [],
    hps: [],
    ...(tick.phase !== undefined ? { phase: tick.phase } : {}),
    ...(tick.wave !== undefined ? { wave: tick.wave } : {}),
  };
}
