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
 * Seconds a fuse-bound cycle spends past the fuse, at a 1.3 s fuse and longer. The MEAN, not the
 * median: the median plant lands 0.17–0.20 s after the fuse, but a tail of waits for other heroes'
 * live crosses puts the mean at 0.47 s, and the mean is what sets a rate.
 */
export const FUSE_CYCLE_OVERHEAD_SEC = 0.47;

/**
 * Seconds a walk-bound cycle spends past `hop / w`, at a 1.3 s fuse and longer. Median 0.18 s like
 * the fuse branch; the mean carries detours and dodges around live crosses. The path walked is the
 * Manhattan hop to 2%.
 */
export const WALK_CYCLE_OVERHEAD_SEC = 0.58;

/**
 * Both overheads at the 0.40 s fuse floor; between 1.3 s and the floor each falls linearly. Fitted
 * together by least squares on every clean cycle of six compact-field captures of one account
 * (2026-10-17 to 2026-10-31, eight heroes at fuses of 0.40–0.65 s), with the long-fuse values
 * held, which the same captures reproduce: their heroes above 1.3 s fit 0.50 s and 0.56 s. The
 * medians are lower still, 0.07–0.13 s past the fuse and ~0.10 s past `hop / w`; a rate needs the
 * mean. The earlier knee, walk only and to 0.33 s, read the floor heroes' cycles 7–38% slow.
 * Measured from frame captures held out of band, not in this repo.
 */
export const FUSE_CYCLE_OVERHEAD_FLOOR_SEC = 0.33;
export const WALK_CYCLE_OVERHEAD_FLOOR_SEC = 0.24;

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
 * The free hop goes as `(w × fuse) ^ HOP_SPEED_EXPONENT`: faster heroes pick farther targets, and
 * a short fuse leaves the next target standing beside the last one. Walk speed and fuse carry the
 * same exponent — 0.38 ± 0.04 and 0.38 ± 0.01 in a within-hero eight-arm A/B, 0.40 ± 0.03 across
 * the farm fields, 0.36–0.37 on duel replays — with no trend across density bands, and the same
 * power law holds through the cooldown cap (hops ×0.60–0.64 at the 0.40 s floor). Measured on frame
 * captures of two accounts' farm fields and on stored PVP duel replays, held out of band, not in
 * this repo. One constant for both factors so they cannot drift apart.
 */
export const HOP_SPEED_EXPONENT = 0.38;
/** Cells per second at which the hop is {@link freeHopCells}'s density mean — the fit's centre. */
export const HOP_SPEED_PIVOT = 3;
/** The fuse at which the hop is {@link freeHopCells}'s density mean — the fit's centre. */
export const HOP_FUSE_PIVOT_SEC = 1.61;

/** The fuse at the 80% cooldown-reduction cap: a fifth of the 2 s base. */
export const FUSE_FLOOR = 0.4;

const OVERHEAD_KNEE_SEC = 1.3;

export function freeHopCells(standing: number): number {
  return FREE_HOP_BASE_CELLS + FREE_HOP_SQRT_CELLS / Math.sqrt(Math.max(1, standing));
}

/** See {@link hopSpeedFactor} for the `exp(k × ln x)` form. */
export function fuseHopFactor(fuseSecs: number): number {
  return Math.exp(HOP_SPEED_EXPONENT * Math.log(Math.max(FUSE_FLOOR, fuseSecs) / HOP_FUSE_PIVOT_SEC));
}

function depthBelowKnee(fuseSecs: number): number {
  if (fuseSecs >= OVERHEAD_KNEE_SEC) return 0;
  return (OVERHEAD_KNEE_SEC - Math.max(FUSE_FLOOR, fuseSecs)) / (OVERHEAD_KNEE_SEC - FUSE_FLOOR);
}

export function fuseCycleOverheadSeconds(fuseSecs: number): number {
  return FUSE_CYCLE_OVERHEAD_SEC - (FUSE_CYCLE_OVERHEAD_SEC - FUSE_CYCLE_OVERHEAD_FLOOR_SEC) * depthBelowKnee(fuseSecs);
}

export function walkCycleOverheadSeconds(fuseSecs: number): number {
  return WALK_CYCLE_OVERHEAD_SEC - (WALK_CYCLE_OVERHEAD_SEC - WALK_CYCLE_OVERHEAD_FLOOR_SEC) * depthBelowKnee(fuseSecs);
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
  return Math.max(
    fuseSecs + fuseCycleOverheadSeconds(fuseSecs),
    hopCells / walkSpeedCells + walkCycleOverheadSeconds(fuseSecs),
  );
}

/** `FREE_HOP_SUFFIX_SUMS[k]` is the sum of {@link FREE_HOP_SHAPE} from index `k` to the end. */
const FREE_HOP_SUFFIX_SUMS: readonly number[] = Object.freeze(
  FREE_HOP_SHAPE.reduceRight<number[]>((sums, multiplier) => [multiplier + (sums[0] ?? 0), ...sums], [0]),
);

/**
 * The mean cycle over the free-hop spread and the re-plants, never the cycle of the mean hop.
 * `meanFreeHop` is {@link freeHopCells} at the standing count times the hero's
 * {@link hopSpeedFactor} — taken by the caller, which prices one hero at many counts.
 *
 * Closed form, because the clear calls this for every hero at every step: the multipliers are
 * ascending, so the fuse-bound hops are exactly the first `k`, and the walk-bound rest sum to
 * `hop/w × (suffix sum) + overhead` each. `replantCycle` and `walkOverheadSecs` depend on the
 * hero alone, so a caller pricing one hero at many counts passes them in.
 */
export function meanPlantCycleSeconds(
  fuseSecs: number,
  walkSpeedCells: number,
  meanFreeHop: number,
  replantCycle: number = plantCycleSeconds(fuseSecs, walkSpeedCells, REPLANT_HOP_CELLS),
  walkOverheadSecs: number = walkCycleOverheadSeconds(fuseSecs),
): number {
  const fuseBound = fuseSecs + fuseCycleOverheadSeconds(fuseSecs);
  const walkPerMultiplier = meanFreeHop / walkSpeedCells;
  const threshold = (fuseBound - walkOverheadSecs) / walkPerMultiplier;
  let fuseBoundHops = 0;
  while (fuseBoundHops < FREE_HOP_SHAPE.length && FREE_HOP_SHAPE[fuseBoundHops] <= threshold) fuseBoundHops++;
  const walkBoundHops = FREE_HOP_SHAPE.length - fuseBoundHops;
  const free =
    fuseBoundHops * fuseBound +
    (walkBoundHops > 0 ? walkPerMultiplier * FREE_HOP_SUFFIX_SUMS[fuseBoundHops] + walkBoundHops * walkOverheadSecs : 0);
  return ((1 - REPLANT_SHARE) * free) / FREE_HOP_SHAPE.length + REPLANT_SHARE * replantCycle;
}
