import type { LiveTick } from '@bombfarm/contracts';

/**
 * What one tick's loot list paid: the props the server reported a gold figure for, and that gold.
 * An entry without a finite gold figure is not a payout and is skipped.
 */
export function countLootPayouts(tick: LiveTick): { props: number; gold: number } {
  let props = 0;
  let gold = 0;
  for (const pop of tick.loot ?? []) {
    if (pop.gold === undefined || !Number.isFinite(pop.gold)) continue;
    gold += pop.gold;
    props += 1;
  }
  return { props, gold };
}

/**
 * A second, independent count of prop destructions — via the map's own `kinds` array going from
 * occupied to cleared — that the per-prop figures' "every destroyed prop pays out exactly once"
 * assumption can be checked against.
 *
 * The wave guard is load-bearing: a wave rollover replaces the whole grid, so diffing a fresh
 * map's layout against the old one reads unrelated cells as spawns and clears that never
 * happened, rather than the one real prop the old map's last frame never got to report cleared.
 *
 * Every map completion ends in exactly this kind of rollover, which permanently hides that map's
 * last clear from the diff — so `totals.payoutProps` only counts a tick's payouts when the diff
 * actually ran for that same tick. Comparing it against `totals.gridClears` then means both
 * counters cover the identical set of ticks, and a divergence means the one-payout-per-prop
 * assumption itself broke, not that a map happened to end.
 */
export class GridClearCounter {
  readonly #totals = { gridClears: 0, payoutProps: 0 };
  #lastKinds: readonly number[] | undefined;
  #lastWave: number | undefined;

  /** Running counts since construction or the last {@link reset}; a live view, not a copy. */
  get totals(): { readonly gridClears: number; readonly payoutProps: number } {
    return this.#totals;
  }

  /** `ran` is whether the grid diff ran for this tick; payouts are counted only when it did. */
  observe(tick: LiveTick, payoutProps: number): { clears: number; ran: boolean } {
    let clears = 0;
    let ran = false;
    if (tick.kinds && this.#lastKinds && tick.wave === this.#lastWave) {
      for (let i = 0; i < this.#lastKinds.length; i += 1) {
        if ((this.#lastKinds[i] ?? -1) >= 0 && tick.kinds[i] === -1) clears += 1;
      }
      this.#totals.gridClears += clears;
      this.#totals.payoutProps += payoutProps;
      ran = true;
    }
    this.#lastKinds = tick.kinds;
    this.#lastWave = tick.wave;
    return { clears, ran };
  }

  reset(): void {
    this.#totals.gridClears = 0;
    this.#totals.payoutProps = 0;
    this.#lastKinds = undefined;
    this.#lastWave = undefined;
  }
}
