/**
 * One hero's plant-to-plant cycle: `max(fuse + fuse overhead, hop / w + walk overhead)`. A hero that
 * reaches its next target before its last bomb detonates waits on the cell; one that arrives later
 * plants on arrival. This is the one cycle behind both the clear integral (`clear-time.ts`) and the
 * per-hero bombs/s (`cadence.ts`).
 *
 * Measured on two accounts' full nine-hero fields at the same 100-prop band after the 2026-09-26
 * patch — 2,868 clean cycles timed exactly from each bomb's own fuse; captures held out of band,
 * not in this repo. Each account fitted alone gives the same overheads to within 0.07 s, and the
 * pooled pair reproduces each account's mean cycle to 0.1%.
 */

/**
 * Seconds a fuse-bound cycle spends past the fuse. The MEAN, not the median: the median plant
 * lands 0.17–0.20 s after the fuse, but a tail of waits for other heroes' live crosses puts the
 * mean at 0.47 s, and the mean is what sets a rate.
 */
export const FUSE_CYCLE_OVERHEAD_SEC = 0.47;

/**
 * Seconds a walk-bound cycle spends past `hop / w`. Median 0.18 s like the fuse branch; the mean
 * carries detours and dodges around live crosses. The path walked is the Manhattan hop to 2%.
 */
export const WALK_CYCLE_OVERHEAD_SEC = 0.58;

/**
 * Free hop between props, cells: `FREE_HOP_BASE_CELLS + FREE_HOP_SQRT_CELLS / sqrt(n)` with `n`
 * props standing. Fitted on 2,602 hops of two cells or more; it runs 3.8–4.1 cells on a full map
 * and ~4.9 under ten standing.
 */
export const FREE_HOP_BASE_CELLS = 3.77;
export const FREE_HOP_SQRT_CELLS = 2.93;

/**
 * The spread of free hops around {@link freeHopCells}: ten equal-probability multipliers, the
 * decile midpoints of `hop / freeHopCells(n)` over the same 2,602 hops, normalised to mean 1.
 *
 * A spread and not the mean because the cycle is `max(fuse, hop / w)`, convex in the hop: short
 * hops turn fuse-bound as the fuse shortens while long ones stay walk-bound, and a single mean hop
 * hides both — it read the cooldown cap at ×1.08 for a slow hero whose own cycles say ×1.2–1.5.
 */
export const FREE_HOP_SHAPE: readonly number[] = Object.freeze([
  0.42, 0.482, 0.639, 0.729, 0.888, 0.978, 1.109, 1.236, 1.473, 2.047,
]);

/** Hop when re-bombing the prop that survived the last hit, cells. */
export const REPLANT_HOP_CELLS = 1;

/**
 * Share of plants that re-bomb from within a cell of the last one. Flat in hits-to-kill: 8.2% on a
 * field needing 2.4 hits per kill, 9.8% on one needing 5.9 — the follow-up hits on a survivor
 * come from other heroes' crosses, not from its bomber re-planting beside it. Priced as
 * `1 − 1 / hits`, it put 60–80% of cycles on the 1-cell hop, which is fuse-bound, and so
 * roughly doubled what the cooldown cap is worth.
 */
export const REPLANT_SHARE = 0.09;

/**
 * Faster heroes pick farther targets: the free hop scales as `(w / HOP_SPEED_PIVOT) ^
 * HOP_SPEED_EXPONENT`. Fitted over 19 heroes on the two fields (`w` 2.4–5.0), and the slope is
 * positive inside each account alone, so it is speed and not a difference between the accounts. A
 * hero's walk time therefore falls as `w ^ −0.47`, not `1 / w`.
 */
export const HOP_SPEED_EXPONENT = 0.53;
/** Cells per second at which the hop is {@link freeHopCells}'s density mean — the fit's centre. */
export const HOP_SPEED_PIVOT = 3;

export function freeHopCells(standing: number): number {
  return FREE_HOP_BASE_CELLS + FREE_HOP_SQRT_CELLS / Math.sqrt(Math.max(1, standing));
}

/**
 * `exp(k × ln x)` rather than `Math.pow(x, k)`: the two agree to the last few bits, but `pow` with
 * a fractional exponent rounded differently on the Linux runners than on Windows, and the
 * optimizer goldens are pinned to the bit.
 */
export function hopSpeedFactor(walkSpeedCells: number): number {
  return Math.exp(HOP_SPEED_EXPONENT * Math.log(walkSpeedCells / HOP_SPEED_PIVOT));
}

export function plantCycleSeconds(fuseSecs: number, walkSpeedCells: number, hopCells: number): number {
  return Math.max(fuseSecs + FUSE_CYCLE_OVERHEAD_SEC, hopCells / walkSpeedCells + WALK_CYCLE_OVERHEAD_SEC);
}

/**
 * The mean cycle over the free-hop spread and the re-plants, never the cycle of the mean hop.
 * `meanFreeHop` is {@link freeHopCells} at the standing count times the hero's
 * {@link hopSpeedFactor} — taken by the caller, which prices one hero at many counts.
 */
export function meanPlantCycleSeconds(fuseSecs: number, walkSpeedCells: number, meanFreeHop: number): number {
  let free = 0;
  for (const multiplier of FREE_HOP_SHAPE) free += plantCycleSeconds(fuseSecs, walkSpeedCells, meanFreeHop * multiplier);
  return (
    ((1 - REPLANT_SHARE) * free) / FREE_HOP_SHAPE.length +
    REPLANT_SHARE * plantCycleSeconds(fuseSecs, walkSpeedCells, REPLANT_HOP_CELLS)
  );
}
