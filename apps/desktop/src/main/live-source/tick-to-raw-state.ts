import type { LiveTick, RawGameState } from '@bombfarm/contracts';

/**
 * `t`, `kinds`, and `hps` do not exist on the live tap's wire — `classifyGameState` requires them
 * only because it was written to validate the game's own raw JSON shape, and nothing downstream
 * of `buildSnapshot` reads their contents. They are stubs here purely so a tap tick can pass that
 * check.
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
