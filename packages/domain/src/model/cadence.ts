/**
 * The one bombing-cadence model behind every DPS figure the companion prints: a hero's plant-to-
 * plant cycle is `E[max(fuse, hop / w)] + latency` over a measured hop-length histogram, with
 * `w = speed × GRID_SPEED_COEF` cells/s and the histogram rescaled to the difficulty band's prop
 * density. Speed therefore shortens every hop the fuse does not already cover.
 *
 * Shared by `combat.ts` (`bombsPerSecond`, and through it the advisor, the next-point ranking, the
 * team-plan scorer and both apps' Combat stage) and by `farm-rate.ts` (the phase-farm board, which
 * precomputes it per band). Both read {@link cycleSecondsForHero}; nothing else computes a cycle.
 * This module sits under `model/` so `combat.ts` can import it without reaching into the farm
 * estimator; `farm-rate.ts` re-exports everything here so its callers and tests are unchanged.
 */
import { PROPS_POR_ATO, propCountForAto } from '../phase-wiki';

/**
 * Plant-to-plant hop distribution: `HOP_DISTRIBUTION[hop]` is the probability that a hero's next
 * bomb lands `hop` grid cells (Manhattan) from its last one. Index is the hop in cells.
 *
 * WHY A DISTRIBUTION AND NOT A MEAN — this is the whole point, do not "simplify" it back:
 * the cycle is `max(fuse, hop/w)`, which is CONVEX in `hop`, so by Jensen
 * `E[max(fuse, hop/w)] > max(fuse, E[hop]/w)`. The retired `E_D_CELLS = 4.5` collapsed the
 * distribution to its mean BEFORE the max and then inverted to a rate — biasing throughput up
 * twice in the same direction. Measured mean hop is 4.77, so the old constant was barely wrong;
 * averaging first is what cost ~25%. The thin tail (hops >= 15, ~3% of plants) carries most of
 * the difference and is exactly what a mean discards.
 *
 * PROVENANCE — the 2026-08-15 combat-throughput capture (`combat-throughput-20260815`,
 * `capture-486-r3`), 662 attributed plant-to-plant hops on account 486 at phase 26 (ato 1,
 * 50 props), across four heroes spanning `w` 1.84–2.07 and blast reach `r` 1 and 3. Re-fit from
 * a fresh capture by pooling `manhattan(previous plant cell, next plant cell)` per hero and
 * normalising. The capture and its analysis are held out of band, not in this repo.
 *
 * DENSITY-SCALED PER ATO, NOT SHARED ACROSS ALL 600 PHASES. This histogram is ato 1's. Applying
 * it verbatim to a denser ato over-predicts hop length and so under-predicts throughput: ato 2
 * packs 75 props onto the same map, so its plants sit `(50/75) ** 0.124 = 0.951x` apart.
 * {@link hopScaleForAto} carries that rescale, {@link HOP_DENSITY_EXPONENT} is the measured
 * density response it is built on, and {@link cycleSecondsForHero} consumes the result. The
 * correction is worth ~2% of clear time at ato 2 — small because the cycle is `max(fuse, hop/w)`
 * and most of this histogram already sits under the fuse floor, which also caps what any further
 * hop refinement can buy at ~1.33x.
 *
 * WHAT IS STILL OPEN AT ATO 2, AND WHY IT IS NOT THIS HISTOGRAM. Against 192 live clears of phase
 * 51 on 2026-08-20, the row lands ~2% fast on gold/hr, and that residual is NOT cadence: feeding
 * the model each hero's actual measured field seconds reproduces the props destroyed to within
 * ~1.6%, while the two terms outside this histogram account for the rest — `heroesOnField` runs
 * 4.784 against 4.673 measured (+2.4%, the House ceiling in {@link allocateHouseSlots}), and gold
 * per prop runs +1.9%. Tuning the hop histogram to absorb either would be fitting one term's error
 * into another's constant. An earlier version of this note recorded the opposite sign (the row
 * running 5.8% LONG, `heroesOnField` 3.310 against 3.46) — that reading predates both the House
 * upgrade from 3 recovery slots to 5 and the {@link HOP_DENSITY_EXPONENT} refit, and two errors
 * were cancelling inside it: the retired `0.5` exponent ran the row fast by ~5% while the
 * deployed-snapshot team auras ran it fast by another ~3%.
 *
 * MEASURED AGAINST A BOT-DRIVEN ACCOUNT, WHICH IS AN UPPER BOUND. The telemetry above comes from
 * an account whose House rotation is automated: its strongest heroes are swapped into the House
 * the instant they empty rather than queueing behind whoever holds a slot, and its Fôlego carriers
 * are deliberately staggered so at least one is on the field ~98% of the time. A hand-played
 * account does neither, so it sustains LESS than these figures — which means this module's greedy
 * {@link allocateHouseSlots} and its cap-after-sum Fôlego total are both calibrated against
 * best-case House play. Neither is a defect against this anchor; both make the board optimistic
 * for a player not driving the rotation that hard, and pinning that gap needs telemetry from a
 * hand-played account, which does not exist yet.
 *
 * KNOWN LIMITATION: one shared distribution cannot express that heroes have individually
 * different hop distributions (the same captures measure `corr(w, meanDist) ~ -0.55` — faster
 * heroes get shorter hops). Against each hero's OWN measured distribution the model lands within
 * 1%; against this pooled one it spreads to +-9%, weighted MAE 4.8% — still 5x better than the
 * 25.6% the retired constant produced. Making the distribution a function of `w` is the next
 * refinement and needs more captures than one account can supply. The density rescale above is
 * geometry, NOT a second fit — no ato beyond 1 has been measured directly, so a capture at
 * ato 3+ is the thing that would confirm or retire it.
 */
export const HOP_DISTRIBUTION: readonly number[] = Object.freeze([
  0.00302, 0.05136, 0.15257, 0.24924, 0.19033, 0.09819, 0.07553, 0.05438, 0.01813, 0.01662,
  0.01511, 0.01208, 0.00755, 0.0136, 0.00755, 0.01057, 0.00755, 0.00302, 0.00151, 0.00151,
  0.00302, 0, 0, 0.00302, 0.00151, 0.00302,
]);

/**
 * Flat per-cycle cost beyond `max(fuse, hop/w)`, seconds — the hero clearing its own blast cross
 * and re-targeting.
 *
 * FITTED, not measured directly. Reading the per-hop floor off the capture gives ~0.25 s, and
 * that is the physically honest number; 0.39 is what minimises error once the SHARED
 * {@link HOP_DISTRIBUTION} replaces each hero's own, so it absorbs some per-hero hop variation
 * the pooled histogram cannot represent. Both are recorded so a future re-fit knows which part
 * is physics and which is compensation — if the distribution ever becomes `w`-dependent, this
 * should fall back toward 0.25.
 *
 * Confirmed independent of blast reach: Minato at `r = 3` sits on the same floor as the `r = 1`
 * heroes, killing the `cycle >= 2 x R/w` conjecture (measured 2026-08-15; the analysis is held
 * out of band, not in this repo).
 */
export const CYCLE_LATENCY_SEC = 0.39;

/**
 * Cycle for a hop of 0 or 1 cell, seconds — its own case, not part of the walk branch.
 *
 * One bomb per cell plus a blast cross of at least +-1 puts the adjacent cell INSIDE the live
 * bomb's own footprint, so the hero cannot plant there until the previous bomb detonates.
 * Measured 2.74-2.82 s across heroes — SLOWER than a 4-cell hop, which is why folding it into
 * `max(fuse, hop/w)` (which would predict the floor, ~2.2 s) understates it. Shipped at the
 * fitted 2.44 s for the same reason {@link CYCLE_LATENCY_SEC} is fitted.
 */
export const HOP1_CYCLE_SEC = 2.44;

/** The ato {@link HOP_DISTRIBUTION} was measured on — ato 1, 50 props. */
export const HOP_FIT_ATO = 1;

/**
 * How strongly mean hop length responds to areal prop density:
 * `hop ∝ density^(−HOP_DENSITY_EXPONENT)`. MEASURED, not assumed — this was `0.5` (an inverse
 * square root) until the 2026-08-20 refit, on the geometric argument that props scattered over a
 * fixed grid sit `1/sqrt(density)` apart. Real plants do not behave that way and the error was
 * worth ~5% of ato-2 clear time on its own.
 *
 * PROVENANCE — the same 662-hop combat capture {@link HOP_DISTRIBUTION} is fitted on, re-read for
 * a quantity nobody had extracted from it before. A clear DESTROYS its props, so live density
 * sweeps the whole range 50 → 0 inside one ato-1 capture; binning each attributed hop by the
 * concurrent live prop count turns that single capture into a density series, with no second
 * capture and no second ato needed. An OLS fit of `log hop` on `log density` over 632 hops gives
 * `0.124`, bootstrap 95% CI `[0.066, 0.158]` — `0.5` sits far outside it.
 *
 * WHY THE TRUE VALUE IS PROBABLY LOWER STILL, and why this ships the conservative end anyway:
 * restricted to `density >= 15` the fit is `0.066`, and to `density >= 25` it is indistinguishable
 * from zero. That is the regime a cross-ato comparison actually asks about — a FRESH ato-2 map at
 * 75 props against a fresh ato-1 map at 50 — because the pooled figure is steepened by the
 * nearly-cleared tail, where the surviving props are not uniformly spread but clustered away from
 * a hero that has just emptied its own neighbourhood. The pooled `0.124` is shipped rather than
 * the subset value because it is the estimate over the whole sample rather than one chosen after
 * seeing which answer it produced; it leaves the ato-2 row ~2% fast rather than ~0%.
 *
 * STILL ONE CAPTURE, ONE ATO, AND PRE-2026-08-18. No capture exists at ato 2 or above, so the
 * cross-ato extrapolation remains an extrapolation — better founded than the geometry it replaces,
 * not confirmed. Hop length is map geometry and hero pathing, neither of which the 2026-08-18
 * crit/cooldown reshape touched (fuse and walk speed reach the cycle through the SHEET, not
 * through this histogram), which is what makes a pre-patch capture usable here; the refit is
 * nonetheless VALIDATED against post-patch telemetry rather than trusted on that argument alone.
 */
export const HOP_DENSITY_EXPONENT = 0.124;

/**
 * Hop-length scale for `ato` relative to {@link HOP_FIT_ATO}:
 * `(props_fit / props_ato) ** HOP_DENSITY_EXPONENT`.
 *
 * Every ato packs its props onto the same map, so a denser ato's plants sit closer together and a
 * hero walks less between them. How MUCH less is {@link HOP_DENSITY_EXPONENT}, which is measured
 * rather than derived — ato 2 carries 75 props against ato 1's 50, putting its plants `0.951x` as
 * far apart, not the `0.816x` the retired square root predicted. `1` at the fit ato by
 * construction — that row is the measurement, not a prediction from it.
 *
 * The ratio is scale-free, so it does not matter whether `props` is read as each ato's STARTING
 * count or as its clear-averaged one: both atos sweep their own count down to zero over a clear,
 * and the two readings differ by a factor that cancels.
 */
export function hopScaleForAto(ato: number): number {
  const props = propCountForAto(ato);
  if (!(props > 0)) return 1;
  return Math.pow(propCountForAto(HOP_FIT_ATO) / props, HOP_DENSITY_EXPONENT);
}

/**
 * Mass landing on hop 0 or 1 picks up {@link HOP1_CYCLE_SEC} rather than the walk branch, which is
 * what keeps the density gain bounded: past a point, packing props closer stops helping because
 * the hero is waiting on its own blast to clear, not on the walk.
 */
function scaleHopDistribution(scale: number): readonly number[] {
  if (!(scale > 0) || scale >= 1) return HOP_DISTRIBUTION;
  const scaled = new Array<number>(HOP_DISTRIBUTION.length).fill(0);
  for (let hop = 0; hop < HOP_DISTRIBUTION.length; hop++) {
    const probability = HOP_DISTRIBUTION[hop];
    if (probability <= 0) continue;
    const target = hop * scale;
    const lower = Math.floor(target);
    const frac = target - lower;
    scaled[lower] += probability * (1 - frac);
    if (frac > 0) scaled[lower + 1] += probability * frac;
  }
  return Object.freeze(scaled);
}

const HOP_DISTRIBUTION_BY_ATO: readonly (readonly number[])[] = Object.freeze(
  PROPS_POR_ATO.map((_, index) => scaleHopDistribution(hopScaleForAto(index + 1))),
);

/** Clamped exactly as `propCountForAto` clamps, so the two never disagree on an out-of-range ato. */
export function atoIndex(ato: number): number {
  return Math.max(1, Math.min(PROPS_POR_ATO.length, Math.round(ato))) - 1;
}

/**
 * `E[max(fuse, hop/w)] + latency` over the hop histogram for `ato`. `Infinity` when the hero
 * cannot move (`w <= 0`), which keeps a degenerate hero at zero throughput rather than dividing
 * by zero.
 *
 * Depends on the phase only through its ATO. The farm board precomputes it per band for each hero
 * (`HeroFarmFacts.plantsPerSecByAto`) so its row layer adds no per-row work; the advisor prices one
 * hero at one band through `Context.ato` and calls it directly.
 */
export function cycleSecondsForHero(
  fuseSecs: number,
  walkSpeedCells: number,
  ato: number = HOP_FIT_ATO,
): number {
  if (!(walkSpeedCells > 0) || !Number.isFinite(walkSpeedCells)) return Infinity;
  const distribution = HOP_DISTRIBUTION_BY_ATO[atoIndex(ato)] ?? HOP_DISTRIBUTION;
  let expected = 0;
  for (let hop = 0; hop < distribution.length; hop++) {
    const probability = distribution[hop];
    if (probability <= 0) continue;
    expected +=
      probability *
      (hop <= 1 ? HOP1_CYCLE_SEC : Math.max(fuseSecs, hop / walkSpeedCells) + CYCLE_LATENCY_SEC);
  }
  return expected;
}
