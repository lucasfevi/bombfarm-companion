import { READ_PACING } from '@bombfarm/game-api';

export interface TriggeredRefreshDeps {
  readonly refreshNow: () => Promise<unknown>;
  readonly now: () => number;
  /** Defaults to `READ_PACING.manualRefreshFloorMs` — the same floor an explicit player-triggered
   *  refresh already respects. A field-membership divergence can repeat many times a second while
   *  it lasts; this is what stops that from ever translating into more than one extra read per
   *  floor window, however often `notify()` is called. */
  readonly floorMs?: number;
}

export interface TriggeredRefresh {
  /** Runs `refreshNow()` unless one has already run within `floorMs`. Safe to call as often as
   *  the caller likes — every call past the floor is a no-op, not a queued one. */
  readonly notify: () => void;
}

export function createTriggeredRefresh(deps: TriggeredRefreshDeps): TriggeredRefresh {
  const floorMs = deps.floorMs ?? READ_PACING.manualRefreshFloorMs;
  let lastTriggeredAt: number | null = null;

  return {
    notify(): void {
      const nowMs = deps.now();
      if (lastTriggeredAt !== null && nowMs - lastTriggeredAt < floorMs) return;
      lastTriggeredAt = nowMs;
      void deps.refreshNow();
    },
  };
}
