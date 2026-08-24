/**
 * Farm-rate estimation for Phase Farm Ranking. Turns a roster + account into gold/hr, chest/hr,
 * key/hr (signed), gem/hr, time-piece/hr, XP/hr, clear time, one-shot and jaula facts for all
 * 600 wiki phases.
 *
 * ESTIMATOR-ONLY BOUNDARY: this module ships its own cadence model
 * (`cycle = E[max(fuse, hop/w)] + latency` over {@link HOP_DISTRIBUTION}) and never touches the
 * advisor's serial model —
 * `farm-context.ts`'s `FARM_CYCLE_MODEL` / `FARM_WALK_DELAY_SEC`, or `model/combat.ts`'s
 * `bombsPerSecond` / `sustainedDps` / `activeDps`. Those keep their exact current behaviour;
 * nothing here reads or writes them, and this module is the only one that computes cadence this
 * way.
 *
 * GATE ATTACK MULT OMITTED (deliberately out of scope): gate rows use the same `avgHitBase` as
 * every other row — `Contra o Relógio`'s gate-only attack bonus is deliberately NOT applied,
 * because the "zero pipeline calls per phase" guarantee depends on mitigation being the
 * ONLY phase-dependent damage term. Applying `gateAttackMult` here would make gate-ness a second
 * one. Cost: gate `clearSecs` runs conservative (slightly slow) for a roster carrying that
 * ability — a follow-up if ever wanted, not a bug.
 *
 * HOUSE RECOVERY IS A SCARCE RESOURCE, AND IT IS THE BINDING ONE. Every hero's `uptime` is its
 * OWN duty cycle `F/(F+T)` — what it would sustain if the House recovered it the instant it left
 * the field. It does not: the House refills only `casa.slots` heroes at a time and the rest queue
 * at frozen energy, gaining nothing. Summing per-hero uptimes (which this module did until the
 * House-ceiling fix) therefore models a House with unlimited parallel recovery. On account 486
 * that roster asks for 5.21 recovery slots against the 3 it owns — a 1.74x overcommit, and the
 * single largest term in the estimator's ~1.54x over-prediction of gold/hr against live bot
 * telemetry. See {@link allocateHouseSlots} for the constraint and why the allocation is greedy.
 *
 * TWO SLOT COUNTS, NOT ONE (`casa-slots.ts`): `SquadFarmFacts.houseSlots` is `casa.slots`, the
 * RECOVERY concurrency; `SquadFarmFacts.fieldSlots` is `skills.field_slots`, the FIELD
 * concurrency. This module read the former as the latter until the fix — harmless on account 486
 * only because the field cap was not binding, but it capped a 6-wide field at 3.
 *
 * TEAM AURAS ARE PRICED OVER THE ROTATION, NOT OFF THE DEPLOYED LINE-UP. `account.teamBuffs` is a
 * snapshot of whoever is standing on the field right now — the correct quantity for the advisor
 * and the team-plan scorer, both of which price one fixed line-up, and the wrong one here. This
 * board rotates a whole pool through the House for hours, so a carrier supplies its aura only for
 * its own share of wall clock. {@link computeHeroFarmBases} therefore re-derives the four combat
 * auras from the ENABLED POOL's own ability ranks, weighted by each hero's uptime
 * (`computeTeamBuffsOverRotation`), and pays a second pipeline pass per hero to do it. Reading the
 * snapshot instead over-predicted gold/hr by 2.6 points on account 486, whose lone rank-20 Grito
 * carrier is on the field 59% of the time and had its +20% attack applied to 100% of every row —
 * and would have UNDER-predicted it by as much on the same roster had the heroes parked on the
 * field at import time been the ones carrying nothing.
 *
 * SORTE-AVERAGE VS FORTUNA-SUM ASYMMETRY — DO NOT "FIX": Sorte (`SquadFarmFacts.sorteFraction`)
 * is a normalized, uptime-weighted AVERAGE of hero-only luck plus the tree's flat share
 * ("the average of on-field heroes' luck"). The Fortuna aura
 * (`FarmRateRow.fortunaAura`) is an UNNORMALIZED uptime-weighted SUM (an aura is
 * a presence effect that stacks across heroes, not an average). These are deliberately different
 * shapes. Live confirmation of the Fortuna-sum's cap order (cap-after-sum,
 * the conservative choice shipped here) is still an open question.
 *
 * FORTUNA MOVED TO THE HOUSE-ALLOCATED BASIS; SORTE DELIBERATELY DID NOT. `fortunaAura` is now
 * `min(FORTUNA_AURA_CAP, Σ (uptime_h × activity_h) × perLevel × level_h)` — the SAME realised
 * on-field basis `heroesOnField` uses, computed in `buildRow` alongside it (see
 * {@link allocateHouseSlots}) rather than in `computeSquadFarmFacts`, for the same phase-dependent
 * reason `concurrencyScale` moved there. Being an UNNORMALIZED SUM, its old unconstrained-uptime
 * basis scaled with `Σ uptime_h` directly, so it overcounted by exactly the House's overcommit
 * ratio whenever the House bound (1.69x on account 486's Fortuna-free roster, had it carried any).
 * `sorteFraction` stays on the unconstrained, phase-independent `uptime_h` basis: being a
 * normalized AVERAGE, the same overcommit does not inflate it the same way — reweighting by the
 * realised (allocated) composition instead would shift the average toward whichever heroes the
 * greedy allocator favours, which has no fixed sign (it depends on whether this roster's
 * high-value-density heroes happen to also be its high-luck ones, and combat throughput and Sorte
 * investment are independent point-budget knobs with no structural reason to correlate). Moving it
 * would also mean relocating a currently phase-independent, once-per-squad reduction into
 * `buildRow`'s per-phase loop for a correction with no known direction — not worth it absent a
 * roster where the correlation is demonstrated. Revisit if one is found.
 */
import {
  fuseSeconds,
  GRID_SPEED_COEF,
  EFF_IA,
  ABILITY_LEVEL_MAX,
  mitigationFactor,
  predictHitDamage,
  critFactor,
  fieldSeconds,
  type Context,
  type HeroSheet,
  type EffectiveDeltas,
} from './model';
import { buildCandidateSheet } from './points-reopt-core';
import { pipelineForHero } from './roster-dps';
import { DEFAULT_CASA_SLOTS } from './casa-slots';
import { computeTeamBuffsOverRotation } from './team-buffs';
import type { SheetKey } from './planner-constants';
import {
  DROP_RATES,
  KEY_GATE_COST,
  RETURN_BONUS_ADD,
  RETURN_BONUS_ADD_VIP,
  LOOT_ABILITY_VALUES,
  WIKI_PROPS,
  WIKI_PHASE_LINES,
  GATE_SECS_POR_ATO,
  BOSS_HP_MULT_WIKI,
  JAULA,
  PROPS_POR_ATO,
  propCountForAto,
  xpPerProp,
  goldRarityMult,
  itemLevelsForPhase,
  itemLevelDropLabel,
  jaulaEarlyCap,
  type WikiPhaseLine,
} from './phase-wiki';
import { hitsToKill, propHp } from './phases';
import type { HeroRecord, AccountShared } from './shims/storage';

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
 * heroes, killing the `cycle >= 2 x R/w` conjecture (research `COMBAT_THROUGHPUT.md`, 2026-08-15).
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
function atoIndex(ato: number): number {
  return Math.max(1, Math.min(PROPS_POR_ATO.length, Math.round(ato))) - 1;
}

/**
 * `E[max(fuse, hop/w)] + latency` over the hop histogram for `ato`. `Infinity` when the hero
 * cannot move (`w <= 0`), which keeps a degenerate hero at zero throughput rather than dividing
 * by zero.
 *
 * Depends on the phase only through its ATO, so this stays a per-hero fact precomputed per ato in
 * {@link HeroFarmFacts.plantsPerSecByAto} — the row layer indexes it and adds NO per-row work and
 * no pipeline calls.
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

/**
 * Fortuna's aura ceiling — the ability's own at-max value, derived from the ability catalog's
 * bundle rather than typed a second time: `LOOT_ABILITY_VALUES.fortuna.perLevel × .max`.
 */
export const FORTUNA_AURA_CAP: number =
  LOOT_ABILITY_VALUES.fortuna.perLevel * LOOT_ABILITY_VALUES.fortuna.max;

/** Off / standard / VIP Return Bonus. Default `'off'`. */
export type ReturnBonusMode = 'off' | 'on' | 'vip';

/**
 * `1 | 1 + RETURN_BONUS_ADD | 1 + RETURN_BONUS_ADD_VIP`. Total function — an unrecognized mode
 * (should TypeScript be bypassed at a call site) falls back to `1` rather than throwing.
 */
export function returnBonusMultiplier(mode: ReturnBonusMode): number {
  if (mode === 'on') return 1 + RETURN_BONUS_ADD;
  if (mode === 'vip') return 1 + RETURN_BONUS_ADD_VIP;
  return 1;
}

// ---------------------------------------------------------------------------------------------
// Per-hero facts (design.md §3.2, §4.1)
// ---------------------------------------------------------------------------------------------

export type HeroFarmFacts = {
  heroId: string;
  heroName: string;
  /** Crit-averaged hit BEFORE phase mitigation; already includes dmgMult (2nd blast, execute). */
  avgHitBase: number;
  /** Effective sheet penetration, PERCENT, unclamped — `mitigationFactor` applies the clamp. */
  penetrationPct: number;
  /** `fuseSeconds(effective.cdr)`, seconds. */
  fuseSecs: number;
  /** Grid walk speed `w = effective.speed × GRID_SPEED_COEF`, CELLS PER SECOND. */
  walkSpeedCells: number;
  /** {@link cycleSecondsForHero} at {@link HOP_FIT_ATO}, seconds — averaged over the hop
   *  distribution, NOT `max()` of a mean hop. `Infinity` when `w <= 0`. */
  cycleSecs: number;
  /** `1 / cycleSecs`, plants per second, at {@link HOP_FIT_ATO}. `0` when `cycleSecs` is not
   *  finite and positive. */
  plantsPerSec: number;
  /**
   * `1 / cycleSecs` per ato, index `ato - 1`, each at that ato's own prop density
   * (see {@link hopScaleForAto}).
   *
   * OPTIONAL, and absent means density-INDEPENDENT: the row layer falls back to
   * {@link plantsPerSec} at every ato, which is what lets a hand-built `HeroFarmFacts` keep a
   * single plant rate. `computeHeroFarmFacts` always populates it.
   */
  plantsPerSecByAto?: readonly number[];
  /** `1 + 0.5 × context.blastRange`, blocks hit per bomb. Note: `blastRange` is already `1 + rangeCells`. */
  blocksPerBomb: number;
  /** House duty cycle as a FRACTION 0..1 (the pipeline reports this as a percent). */
  uptime: number;
  /** Hero-only Sorte in PERCENTAGE POINTS — the tree's flat share peeled out. */
  heroLuckPct: number;
  /** `abilities.veia_ouro`, clamped to `[0, ABILITY_LEVEL_MAX]`. */
  veiaOuroLevel: number;
  /** `abilities.fortuna`, clamped to `[0, ABILITY_LEVEL_MAX]`. */
  fortunaLevel: number;
  /** True when this hero contributes no throughput: `avgHitBase <= 0` or `plantsPerSec <= 0`. */
  degenerate: boolean;
};

export type FarmFactsInput = {
  heroes: readonly HeroRecord[];
  account: AccountShared;
  /**
   * The rotation pool. `null`/omitted ⇒ every hero with `battleAllowed !== false`.
   * An explicit `[]` means an EMPTY pool, not "use the default". Ids not present in `heroes` are
   * ignored (intersection semantics).
   */
  enabledHeroIds?: readonly string[] | null;
};

function clampAbilityLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(ABILITY_LEVEL_MAX, level));
}

function resolveEnabledHeroes(
  heroes: readonly HeroRecord[],
  enabledHeroIds: readonly string[] | null | undefined,
): readonly HeroRecord[] {
  if (enabledHeroIds == null) return heroes.filter((hero) => hero.battleAllowed !== false);
  const idSet = new Set(enabledHeroIds);
  return heroes.filter((hero) => idSet.has(hero.id));
}

// ---------------------------------------------------------------------------------------------
// The per-hero farm basis — one pipeline call, then pure scalar math for any candidate vector.
// ---------------------------------------------------------------------------------------------

/**
 * Everything about one hero that a farm evaluation needs, extracted from the ONE
 * `pipelineForHero(hero, account, 1, 0)` call the estimator already makes. Facts for any
 * candidate point vector are pure scalar math from here — no second pipeline entry, ever.
 */
export type HeroFarmBasis = {
  heroId: string;
  heroName: string;
  /** The hero's level — its whole stat-point pool, and the respec-cost input. */
  level: number;
  /** Full 8-key current allocation, exactly as read off the `HeroRecord`. */
  pts: Record<SheetKey, number>;
  /** The pipeline's effective combat sheet AT `pts` — the affine reconstruction's base point. */
  effective: HeroSheet;
  /** The pipeline's per-point effective deltas. Independent of `pts`, which is what makes the
   *  reconstruction exact rather than approximate. */
  effectiveDelta: EffectiveDeltas;
  /** The hero's farm `Context`. `drainMult`, `restSeconds` and `blastRange` are read;
   *  `mitigation` is 0 here and is never read — the row layer applies phase mitigation. */
  context: Context;
  /** Ability/team damage multiplier — build-independent. */
  dmgMult: number;
  /** Hero-only Sorte, PERCENTAGE POINTS. Frozen: luck is outside the reallocatable budget. */
  heroLuckPct: number;
  /** Clamped ability levels — build-independent. */
  veiaOuroLevel: number;
  fortunaLevel: number;
  /** `1 + 0.5 × context.blastRange` — ability-driven, build-independent, precomputed. */
  blocksPerBomb: number;
};

/**
 * One `pipelineForHero` call per enabled hero, against whatever `account.teamBuffs` it is handed.
 * Order follows `heroes`. {@link computeHeroFarmBases} is the entry point; this is its pass.
 */
function basesForAccount(
  enabledHeroes: readonly HeroRecord[],
  account: AccountShared,
): HeroFarmBasis[] {
  const treeLuckFlatPct = account.tree.luckFlatPct ?? 0;

  return enabledHeroes.map((hero) => {
    // AD-032: the sole HeroRecord entry to the pipeline. phase=1 (not null) + mitigationPct=0
    // is deliberate — `effectiveMitigationPct` only honors mitigationPct=0 when phase is a
    // positive number; with `null` it substitutes phase 1's wiki mitigation instead (design.md §0).
    const pipeline = pipelineForHero(hero, account, 1, 0);

    const heroLuckPct = Math.max(0, pipeline.adjusted.luck - treeLuckFlatPct);
    const veiaOuroLevel = clampAbilityLevel(hero.abilities.veia_ouro ?? 0);
    const fortunaLevel = clampAbilityLevel(hero.abilities.fortuna ?? 0);
    const blocksPerBomb = 1 + 0.5 * pipeline.context.blastRange;

    const basis: HeroFarmBasis = {
      heroId: hero.id,
      heroName: hero.name,
      level: hero.level,
      pts: { ...hero.pts },
      effective: pipeline.effective,
      effectiveDelta: pipeline.A.effectiveDelta,
      context: pipeline.context,
      dmgMult: pipeline.dmgMult,
      heroLuckPct,
      veiaOuroLevel,
      fortunaLevel,
      blocksPerBomb,
    };
    return basis;
  });
}

/**
 * The presence weight one basis contributes to the rotation's aura total: its own duty cycle
 * `F/(F+T)` at its own points, the same quantity {@link HeroFarmFacts.uptime} carries.
 *
 * Deliberately NOT `uptime x activity` (the House-ALLOCATED basis `heroesOnField` and
 * `fortunaAura` use). `activity` is decided per phase by {@link allocateHouseSlots}, so weighting
 * by it would make every hero's SHEET — attack, speed, crit, drain — a function of the phase being
 * priced, and with it the pipeline call that produces the sheet. That is the one thing this module
 * is built not to do: `plantsPerSecByAto` and the whole `HeroFarmBasis` exist so a row costs zero
 * pipeline calls. `sorteFraction` stays on this same unconstrained basis for a related reason —
 * see the module header's SORTE-AVERAGE VS FORTUNA-SUM ASYMMETRY note. The cost is that the auras
 * run slightly rich whenever the House is the binding constraint; on account 486 (5 recovery slots
 * against a 7.34-slot demand) the lone Grito carrier's unconstrained uptime is 0.578 against a
 * live-measured field presence of 0.591, so the term is inside 3% of measurement there.
 *
 * Reads `basis.effective` rather than rebuilding the sheet: `heroFactsFromBasis(b, b.pts)` is
 * documented to reproduce exactly that sheet, and only the weight is wanted here.
 */
function presenceWeightForBasis(basis: HeroFarmBasis): number {
  const field = fieldSeconds(basis.effective, basis.context);
  return (100 * field) / (field + basis.context.restSeconds) / 100;
}

/**
 * TWO PIPELINE PASSES PER HERO, NOT ONE — and never a third. Team auras are a property of the
 * field ({@link computeTeamBuffsOverRotation}), so on a board that rotates a pool through the
 * House each carrier supplies its aura only for its own share of wall clock. Pricing that needs
 * every hero's uptime, and uptime comes out of the pipeline, so the two are mutually dependent:
 *
 *   pass 1  auras at FULL presence (the pool's at-best total) -> each hero's uptime
 *   pass 2  auras weighted by those uptimes -> the bases actually returned
 *
 * FIXED AT TWO, deliberately, rather than iterated to a fixed point. Only Fôlego closes the loop
 * at all (it is the sole aura reaching `Context.drainMult`, and so the sole one reaching uptime);
 * Grito, Marcha and Presságio move attack, speed and crit, none of which touch `fieldSeconds`. So
 * the residual is second-order in one scalar, and the loop is at its least sensitive exactly where
 * rosters land in practice — a Fôlego total at or above its cap has no sensitivity left at all.
 * A convergence loop would buy that second order back at the price of a call count that is no
 * longer a fixed multiple of roster size, which is the invariant `farm-rate-perf-guard.test.ts`
 * exists to hold: 2N, never a function of the 600 rows.
 *
 * SEEDED FROM THE POOL, NOT FROM WHO IS DEPLOYED. Pass 1 uses the enabled pool's own at-best
 * total, so nothing the board prints depends on which heroes happened to be standing on the field
 * at import time. That dependence WAS the defect: `account.teamBuffs` is a snapshot of the
 * deployed line-up, and reading it here applied a deployed carrier's aura to 100% of a rotation it
 * is present for a fraction of (and, in the mirror case, withheld a pooled carrier's aura
 * entirely). Toggling a carrier out of the rotation pool now correctly removes its aura too.
 *
 * ONE PASS, VERBATIM, WHEN THE TOTAL IS HAND-TYPED. `account.teamBuffsOverride` marks a
 * deliberate "assume this much aura" what-if with no carrier attribution behind it to weight, so
 * it reaches the pipeline untouched and this collapses back to N calls.
 */
function priceTeamBuffs(
  enabledHeroes: readonly HeroRecord[],
  account: AccountShared,
): Record<string, number> {
  if (account.teamBuffsOverride != null) return account.teamBuffs;
  const atFullPresence = computeTeamBuffsOverRotation(enabledHeroes, null);
  const seeded = basesForAccount(enabledHeroes, { ...account, teamBuffs: atFullPresence });
  return computeTeamBuffsOverRotation(enabledHeroes, seeded.map(presenceWeightForBasis));
}

/**
 * The team-aura totals this module actually prices its rows against — the rotation-weighted
 * figures {@link computeHeroFarmBases} feeds the pipeline, NOT `account.teamBuffs`.
 *
 * Exported because two callers legitimately need them. Any surface reporting what the board
 * assumed has to quote these rather than the account panel's numbers: a roster whose sole rank-20
 * Grito carrier runs at uptime 0.578 is priced at 11.57, and printing the panel's 20 next to a
 * gold/hr computed from 11.57 explains neither. And any test asserting farm-rate's per-hero facts
 * against a direct `pipelineForHero` call must hand that call THESE buffs, or it compares two
 * different accounts and calls the difference a regression.
 *
 * Costs `N` pipeline calls when called on its own (the seeding pass). Callers that also want the
 * bases should call {@link computeHeroFarmBases}, which shares the pass rather than repeating it.
 */
export function farmTeamBuffs(input: FarmFactsInput): Record<string, number> {
  const { heroes, account, enabledHeroIds } = input;
  return priceTeamBuffs(resolveEnabledHeroes(heroes, enabledHeroIds), account);
}

/** The account {@link computeHeroFarmBases} prices against — `account` with {@link farmTeamBuffs}
 *  substituted. Exported for the same two callers, so neither has to rebuild the spread itself. */
export function farmPricedAccount(input: FarmFactsInput): AccountShared {
  return { ...input.account, teamBuffs: farmTeamBuffs(input) };
}

export function computeHeroFarmBases(input: FarmFactsInput): HeroFarmBasis[] {
  const { heroes, account, enabledHeroIds } = input;
  const enabledHeroes = resolveEnabledHeroes(heroes, enabledHeroIds);
  const teamBuffs = priceTeamBuffs(enabledHeroes, account);
  return basesForAccount(enabledHeroes, { ...account, teamBuffs });
}

/**
 * Facts for ANY candidate 8-key vector. Pure scalar math; zero pipeline calls.
 * `heroFactsFromBasis(b, b.pts)` is byte-identical to `computeHeroFarmFacts`'s entry for `b`.
 *
 * TEAM AURAS ARE FROZEN AT THE BASIS, like every other pipeline-derived term here. The rotation
 * pricing in {@link computeHeroFarmBases} reads every hero's uptime, and uptime moves with the
 * point vector (energy buys field seconds), so a candidate vector strictly speaking implies its
 * own aura totals. Re-pricing them per candidate would cost a pipeline call per candidate and
 * delete the entire reason this function exists. It is held fixed instead, exactly as
 * `basis.context`, `basis.dmgMult` and the Grito factor already baked into `basis.effective` are.
 * The error is second-order and one-sided-small: only Fôlego reaches uptime at all, a respec moves
 * uptime by a few percent at most, and a Fôlego total sitting at its cap — where multi-carrier
 * rosters land — has no sensitivity left whatsoever.
 *
 * THE TRAP: `uptime` must repeat the pipeline's own two-step expression
 * `((100 × field) / (field + rest)) / 100`, not the algebraically-equal `field / (field + rest)`
 * — they are not bit-equal in IEEE754 (design.md §2.1). Do not "simplify" this.
 */
export function heroFactsFromBasis(basis: HeroFarmBasis, pts: Record<SheetKey, number>): HeroFarmFacts {
  const sheet = buildCandidateSheet(basis.effective, basis.pts, basis.effectiveDelta, pts);

  const avgHitBase =
    predictHitDamage(sheet.attack, 0, sheet.penetration, basis.dmgMult) * critFactor(sheet.critChance, sheet.critDmg);
  const penetrationPct = sheet.penetration;
  const fuseSecs = fuseSeconds(sheet.cdr);
  const walkSpeedCells = sheet.speed * GRID_SPEED_COEF;
  const plantsPerSecByAto = Object.freeze(
    PROPS_POR_ATO.map((_, index) => {
      const cycle = cycleSecondsForHero(fuseSecs, walkSpeedCells, index + 1);
      return Number.isFinite(cycle) && cycle > 0 ? 1 / cycle : 0;
    }),
  );
  const cycleSecs = cycleSecondsForHero(fuseSecs, walkSpeedCells);
  const plantsPerSec = plantsPerSecByAto[HOP_FIT_ATO - 1];
  const field = fieldSeconds(sheet, basis.context);
  const uptime = (100 * field) / (field + basis.context.restSeconds) / 100;
  const degenerate = !(avgHitBase > 0) || !(plantsPerSec > 0);

  const facts: HeroFarmFacts = {
    heroId: basis.heroId,
    heroName: basis.heroName,
    avgHitBase,
    penetrationPct,
    fuseSecs,
    walkSpeedCells,
    cycleSecs,
    plantsPerSec,
    plantsPerSecByAto,
    blocksPerBomb: basis.blocksPerBomb,
    uptime,
    heroLuckPct: basis.heroLuckPct,
    veiaOuroLevel: basis.veiaOuroLevel,
    fortunaLevel: basis.fortunaLevel,
    degenerate,
  };
  return facts;
}

/**
 * Squad facts for a whole candidate assignment, keyed by hero id. Heroes absent from the map
 * use their own `basis.pts`. Zero pipeline calls.
 */
export function squadFactsFromBases(
  bases: readonly HeroFarmBasis[],
  ptsByHeroId: ReadonlyMap<string, Record<SheetKey, number>> | null,
  account: AccountShared,
): SquadFarmFacts {
  const heroFacts = bases.map((basis) => heroFactsFromBasis(basis, ptsByHeroId?.get(basis.heroId) ?? basis.pts));
  return computeSquadFarmFacts(heroFacts, account);
}

/** {@link computeHeroFarmBases}'s call count (2N, or N on an override). Order follows `heroes`. */
export function computeHeroFarmFacts(input: FarmFactsInput): HeroFarmFacts[] {
  return computeHeroFarmBases(input).map((basis) => heroFactsFromBasis(basis, basis.pts));
}

// ---------------------------------------------------------------------------------------------
// Squad facts (design.md §3.3, §4.2)
// ---------------------------------------------------------------------------------------------

export type SquadFarmFacts = {
  /** Enabled heroes only, in `heroes` order. */
  heroes: readonly HeroFarmFacts[];
  /**
   * FIELD concurrency cap — how many heroes may be deployed at once.
   * `account.fieldSlots ?? account.slots ?? DEFAULT_CASA_SLOTS`.
   *
   * The `account.slots` rung is a BACK-COMPAT fallback, not a synonym: an account stored before
   * `skills.field_slots` was plumbed carries only `slots`, and that (wrong, House-sourced) number
   * is still strictly better than inventing `DEFAULT_CASA_SLOTS` for it. A save-backed account
   * never reaches that rung.
   */
  fieldSlots: number;
  /**
   * HOUSE RECOVERY concurrency — how many heroes the House refills at a time.
   * `account.slots ?? DEFAULT_CASA_SLOTS`. Never the field cap; see {@link fieldSlots}.
   */
  houseSlots: number;
  /**
   * `Σ uptime` over enabled heroes (fractions) — the UNCONSTRAINED on-field expectation, i.e.
   * what the roster would sustain given unlimited parallel House recovery. Kept as the Sorte /
   * Fortuna weighting basis and as the numerator the House ceiling is measured against; it is
   * NOT the number of heroes actually on the field (that is `FarmRateRow.heroesOnField`, which is
   * phase-dependent because the allocation is).
   */
  uptimeSum: number;
  /**
   * `Σ (1 − uptime_h)` — House recovery slots the roster demands, in slot-seconds per second.
   *
   * Each hero cycles `F_h` seconds on field then `T` seconds recovering, so it occupies a
   * recovery slot for a fraction `T/(F_h+T)` of wall clock. Since `uptime_h = F_h/(F_h+T)`, that
   * fraction is exactly `1 − uptime_h` — no field-seconds or cycle-seconds term is needed here,
   * which is why {@link HeroFarmFacts} does not have to carry either. Phase-independent (uptime
   * is), so it lives on the squad rather than the row. `> houseSlots` means the House is the
   * binding constraint: 5.21 vs 3 on account 486.
   */
  houseSlotDemand: number;
  /** Sorte as a FRACTION: `(uptime-weighted mean heroLuckPct + treeLuckFlatPct) / 100`. */
  sorteFraction: number;
  /** `1 + max(0, tree.teamCoinPct) / 100`. */
  teamCoinMult: number;
  /** `tree.luckFlatPct ?? 0`, percentage points — echoed for the board's breakdown tooltip. */
  treeLuckFlatPct: number;
  /**
   * `tree.xpMult`, verbatim — a direct multiplier (not a percentage add, unlike
   * {@link teamCoinMult}), so absent/non-finite defaults to `1` (identity) rather than `0`,
   * which would silently zero every XP figure. Derived here, once per squad, rather than read
   * from `account.tree` inside `buildRow` — same reasoning as `teamCoinMult`.
   */
  xpMult: number;
};

/**
 * One hero's claim on the House, in recovery slot-seconds per second of wall clock:
 * `T/(F+T) = 1 − uptime`. Clamped to `[0, 1]` so a hand-built `HeroFarmFacts` carrying an
 * out-of-range `uptime` cannot hand the allocator a negative budget or a demand above one slot.
 *
 * `uptime === 1` (a hero that never rests — zero rest seconds) costs nothing and is never
 * throttled; `uptime === 0` (a hero that never deploys, including the zero-field-seconds case)
 * costs a full slot but delivers nothing, so the greedy ordering below places it last.
 */
function houseSlotDemand(hero: HeroFarmFacts): number {
  const demand = 1 - hero.uptime;
  if (!Number.isFinite(demand)) return 0;
  return Math.min(1, Math.max(0, demand));
}

export function computeSquadFarmFacts(
  heroFacts: readonly HeroFarmFacts[],
  account: AccountShared,
): SquadFarmFacts {
  const houseSlots = account.slots ?? DEFAULT_CASA_SLOTS;
  const fieldSlots = account.fieldSlots ?? account.slots ?? DEFAULT_CASA_SLOTS;
  const uptimeSum = heroFacts.reduce((sum, hero) => sum + hero.uptime, 0);
  const houseSlotDemandSum = heroFacts.reduce((sum, hero) => sum + houseSlotDemand(hero), 0);
  const treeLuckFlatPct = account.tree.luckFlatPct ?? 0;

  const heroLuckWeightedSum = heroFacts.reduce((sum, hero) => sum + hero.uptime * hero.heroLuckPct, 0);
  const sorteFraction = ((uptimeSum > 0 ? heroLuckWeightedSum / uptimeSum : 0) + treeLuckFlatPct) / 100;

  const teamCoinMult = 1 + Math.max(0, account.tree.teamCoinPct ?? 0) / 100;

  const rawXpMult = account.tree.xpMult;
  const xpMult = typeof rawXpMult === 'number' && Number.isFinite(rawXpMult) ? rawXpMult : 1;

  return {
    heroes: heroFacts,
    fieldSlots,
    houseSlots,
    uptimeSum,
    houseSlotDemand: houseSlotDemandSum,
    sorteFraction,
    teamCoinMult,
    treeLuckFlatPct,
    xpMult,
  };
}

/**
 * The House recovery-slot ceiling: `Σ_h (1 − uptime_h) × a_h <= houseSlots`.
 *
 * Returns one ACTIVITY FACTOR `a_h ∈ [0, 1]` per hero, index-aligned with `heroes` — the fraction
 * of the rotation that hero actually participates in once the House's recovery slots are
 * rationed. A hero's realised on-field expectation is `uptime_h × a_h`, and its realised prop rate
 * is its unconstrained rate × `a_h`.
 *
 * GREEDY, NOT UNIFORM — the model choice, not an optimisation. The real client lets the strongest
 * hero take a House slot ahead of a weaker one, so the scarce slot-seconds go to the highest
 * value density first, each hero taken up to its OWN duty-cycle ceiling `uptime_h`, with the
 * marginal hero partially served by whatever budget is left. Uniform throttling (scaling every
 * hero by the same `houseSlots / demand`) undershoots badly: on account 486 it predicts 1.03
 * heroes on field against a live-measured 1.317, where greedy predicts 1.315.
 *
 * VALUE DENSITY is `value / cost` = the hero's unconstrained prop rate (`fullTerms[i]`, props per
 * second of wall clock at its own full duty) divided by its slot demand. That ratio equals
 * `propRate_h × F_h / T` — i.e. props delivered per deployment, over the shared House cycle — so
 * ordering by it is exactly ordering by props-per-deployment. `F_h` never appears: the `T` factor
 * is common to every hero (one House per account) and cancels out of the comparison, which is
 * what lets this run off `uptime` alone.
 *
 * PHASE-DEPENDENT BY NECESSITY, hence a `buildRow` call and not a `computeSquadFarmFacts` one:
 * `fullTerms` carries the phase's mitigation, so the ORDER heroes claim slots in genuinely
 * changes with phase. This costs one O(n log n) sort over the enabled roster per row (7 heroes ×
 * 600 rows) and — critically — zero pipeline calls: it reads only `HeroFarmFacts` scalars the
 * row layer already has.
 */
function allocateHouseSlots(
  heroes: readonly HeroFarmFacts[],
  fullTerms: readonly number[],
  houseSlots: number,
): number[] {
  const activity = new Array<number>(heroes.length).fill(0);
  const demands = new Array<number>(heroes.length).fill(0);
  const contenders: number[] = [];

  for (let i = 0; i < heroes.length; i++) {
    const demand = houseSlotDemand(heroes[i]);
    demands[i] = demand;
    // Costs the House nothing (never rests) — always fully active, never queued behind anyone.
    if (demand <= 0) activity[i] = 1;
    else contenders.push(i);
  }

  // A non-finite slot count means "no House constraint" rather than a NaN budget.
  let budget = Number.isFinite(houseSlots) ? Math.max(0, houseSlots) : Infinity;

  // Ties (and any non-finite ratio, e.g. a zero-rate hero) fall back to roster order, so the
  // allocation is a deterministic function of the inputs — the optimizer's determinism suite
  // compares whole tables across runs.
  const ratios = fullTerms.map((term, i) => {
    const ratio = term / demands[i];
    return Number.isFinite(ratio) ? ratio : 0;
  });
  contenders.sort((left, right) => (ratios[right] - ratios[left]) || (left - right));

  for (const index of contenders) {
    if (!(budget > 0)) break;
    const demand = demands[index];
    // `min(1, ...)` is the hero's own duty-cycle ceiling: extra slot budget cannot push a hero
    // past the uptime its energy pool and the House cycle already fix.
    const take = Math.min(1, budget / demand);
    activity[index] = take;
    budget -= demand * take;
  }

  return activity;
}

/** Rounds are cheap and convergence is fast (under 10 on every roster measured); this cap is a
 *  non-termination guard, not a tuning knob. */
const FIELD_ROUNDS_MAX = 64;
const FIELD_DEMAND_EPSILON = 1e-13;

/**
 * `P(more heroes hold full energy than the field has room for)` — how much of the rotation's wall
 * clock is spent with a rested hero benched behind a full field.
 *
 * A DIAGNOSTIC, NOT A THROUGHPUT TERM. Nothing multiplies by it, and deliberately so: what the
 * contention COSTS depends on which hero gets the free slot, and that is a behaviour the game does
 * not fix (a player redeploys whoever they notice; only an automation would rank by damage). The
 * FREQUENCY does not depend on that choice — it is a property of the energy cycles alone — which
 * is exactly why this is reportable when a correction factor is not. Measured across seven
 * roster/slot regimes, uniformly-random deployment and strongest-first deployment differ by up to
 * 24% in throughput and under 3 points in this figure.
 *
 * THE MODEL. Each hero holds full energy independently with its own House-allocated duty cycle, so
 * the number wanting the field is Poisson-binomial. Demand is solved for rather than assumed: a
 * benched hero does not drain, so its cycle stretches and its demand runs ABOVE its duty cycle
 * (8.30 against a `Σ uptime` of 8.08 on account 486 at 9 slots). Writing `phi_h = u_h / (1 - u_h)`
 * — the hero's field time measured in House cycles — a common admission share `s` stretches the
 * cycle to `demand_h = phi_h / (phi_h + s)`, which collapses to `u_h` exactly when `s = 1`. `phi`
 * is why no `restSeconds` is needed: the House cycle is common to every hero and cancels, the same
 * reason {@link allocateHouseSlots} runs off `uptime` alone.
 *
 * The share is COMMON to every hero rather than per-hero, which is what keeps this free of any
 * deployment order. Against a 240h simulation with uniformly-random deployment: 24.0% predicted
 * against 24.4% measured at 9 slots, 0% against 0% wherever the field cannot fill, and worst case
 * 7 points out on a small pool at a hard cap.
 */
function fieldContentionFraction(effectiveUptime: readonly number[], fieldSlots: number): number {
  const count = effectiveUptime.length;
  // A non-finite slot count means "no field constraint", matching `allocateHouseSlots`'s budget.
  if (count === 0 || !Number.isFinite(fieldSlots)) return 0;
  const slots = Math.max(0, fieldSlots);
  // Every hero fits even standing together: no distribution can cross the cap.
  if (slots >= count) return 0;

  const phi = effectiveUptime.map((uptime) =>
    uptime >= 1 ? Infinity : uptime <= 0 ? 0 : uptime / (1 - uptime),
  );

  const poissonBinomial = (demand: readonly number[]): number[] => {
    let pmf: number[] = [1];
    for (const probability of demand) {
      const extended = new Array<number>(pmf.length + 1).fill(0);
      for (let taken = 0; taken < pmf.length; taken++) {
        extended[taken] += pmf[taken] * (1 - probability);
        extended[taken + 1] += pmf[taken] * probability;
      }
      pmf = extended;
    }
    return pmf;
  };

  let demand = effectiveUptime.slice();
  for (let round = 0; round < FIELD_ROUNDS_MAX; round++) {
    const pmf = poissonBinomial(demand);
    let wanted = 0;
    for (const value of demand) wanted += value;
    let served = 0;
    for (let taken = 0; taken < pmf.length; taken++) served += pmf[taken] * Math.min(slots, taken);
    const share = wanted > 0 ? served / wanted : 1;
    let delta = 0;
    const next = demand.slice();
    for (let index = 0; index < count; index++) {
      next[index] = phi[index] === Infinity ? 1 : phi[index] <= 0 ? 0 : phi[index] / (phi[index] + share);
      delta = Math.max(delta, Math.abs(next[index] - demand[index]));
    }
    demand = next;
    if (delta < FIELD_DEMAND_EPSILON) break;
  }

  const pmf = poissonBinomial(demand);
  let contention = 0;
  for (let taken = 0; taken < pmf.length; taken++) if (taken > slots) contention += pmf[taken];
  return Math.min(1, Math.max(0, contention));
}

/** See {@link HeroFarmFacts.plantsPerSecByAto} for why the array may be absent. */
function plantsPerSecForAto(hero: HeroFarmFacts, ato: number): number {
  return hero.plantsPerSecByAto?.[atoIndex(ato)] ?? hero.plantsPerSec;
}

/** Blocks struck per second while on field: `plantsPerSec(ato) × blocksPerBomb × EFF_IA`. */
function hitsPerSec(hero: HeroFarmFacts, ato: number): number {
  return plantsPerSecForAto(hero, ato) * hero.blocksPerBomb * EFF_IA;
}

// ---------------------------------------------------------------------------------------------
// Module-load prop table (design.md §2.2) — phase-independent, computed once, frozen.
// ---------------------------------------------------------------------------------------------

type PropShare = { hpMult: number; share: number; goldMult: number };

const PROP_WEIGHT_TOTAL = WIKI_PROPS.reduce((sum, prop) => sum + prop.weight, 0);

/** `{ hpMult, share, goldMult }` per wiki prop — `share` and `goldMult` are phase-independent. */
const PROP_SHARES: readonly PropShare[] = WIKI_PROPS.map((prop) => ({
  hpMult: prop.hpMult,
  share: prop.weight / PROP_WEIGHT_TOTAL,
  goldMult: goldRarityMult(prop.rarity),
}));

/** Highest `hpMult` across `WIKI_PROPS` — the one-shot threshold multiplier. */
const MAX_PROP_HP_MULT = WIKI_PROPS.reduce((max, prop) => Math.max(max, prop.hpMult), 0);

/** `Σ share × goldRarityMult` — the phase-independent gold factor (`design.md` §2.2: `1.545`). */
const GOLD_SHARE_FACTOR = PROP_SHARES.reduce((sum, prop) => sum + prop.share * prop.goldMult, 0);

// ---------------------------------------------------------------------------------------------
// Rows (design.md §3.4, §4.3–§4.5)
// ---------------------------------------------------------------------------------------------

export type FarmRateOptions = {
  /** Default `'off'`. */
  returnBonus?: ReturnBonusMode;
  /** `account.max_phase`. `null`/omitted ⇒ every row `locked: false`. */
  maxPhase?: number | null;
};

export type FarmRateRow = {
  phase: number; // 1..600
  ato: number; // 1..5
  gate: boolean;
  locked: boolean; // phase > maxPhase
  mitigationPct: number; // line.mitig × 100 — PERCENT
  goldPerHour: number;
  chestsPerHour: number;
  /** SIGNED: `>= 0` gain on non-gate, `<= 0` cost on gate. */
  keysPerHour: number;
  gemsPerHour: number; // 0 on non-gate
  timePiecesPerHour: number; // 0 on non-gate
  /** Gate-only, `0` on non-gate. Its own base rate (`DROP_RATES.stone`, wiki `pedra.drop_rate`),
   *  which the 2026-08-23 patch raised tenfold to `0.0005` — it is no longer the same rate as
   *  {@link gemsPerHour}, which stayed at `0.00005`. */
  stoneChestsPerHour: number;
  xpPerHour: number;
  /** Props destroyed per hour, over the WHOLE cycle — on a gate that includes the boss, which
   *  drops none. Always consistent with {@link clearSecs}: `cyclesPerHour × propsPerMap`. */
  propsPerHour: number;
  cyclesPerHour: number; // 0 when clearSecs is not finite
  /** Seconds to clear the map (+ gate boss). `Infinity` when the squad cannot clear it. */
  clearSecs: number;
  gateTimerSecs: number | null; // null on non-gate
  /** Every enabled hero one-shots every prop type. `false` for an empty pool. */
  oneShot: boolean;
  /** gate timeout OR unbounded clear OR zero prop rate. */
  infeasible: boolean;
  itemLevels: number[];
  itemLevelLabel: string;
  jaulaEarlyCapPct: number; // PERCENT (a fact, not a rate); jaulaEarlyCap(phase)
  /** `JAULA.janelaSecs` — non-VIP, constant across phases since the wiki bundle's JAULA reshape. */
  jaulaWindowSecs: number;
  /** Throughput-weighted squad E[HTK] — diagnostics for the board's tooltip. `Infinity` when zero-rate. */
  expectedHtk: number;
  /**
   * Expected heroes simultaneously on the field at this phase, AFTER the House recovery-slot
   * ceiling and BEFORE the field-slot cap: `Σ uptime_h × a_h` (see {@link allocateHouseSlots}).
   *
   * Phase-dependent because the greedy allocation is — mitigation reorders which heroes win the
   * scarce recovery slots. `<= squad.uptimeSum` always, with equality exactly when the House is
   * not binding. Live-measured 1.317 on account 486 at phase 26 against `uptimeSum` 1.7905.
   */
  heroesOnField: number;
  /**
   * The FIELD-slot cap actually applied: `min(1, fieldSlots / heroesOnField)`; `1` when
   * `heroesOnField === 0`. Applied AFTER the House ceiling — the House decides how many heroes
   * the rotation can keep fed, and only then does the field cap ask whether they all fit.
   * Capping raw `uptimeSum` instead would charge the roster twice for the same shortage.
   *
   * KNOWN APPROXIMATE, and left that way deliberately. It compares a MEAN against the cap, so it
   * misses the loss whenever occupancy fluctuates across a cap its average sits under (`min` is
   * concave: `E[min(c, X)] <= min(c, E[X])`). Correcting it needs to know which hero takes a
   * freed slot, and the game fixes no such rule — a player redeploys whoever they notice.
   * Measured against a 240h simulation with uniformly-random deployment, this expression is
   * within 6.7% across seven roster/slot regimes and no simple closed form tested beat it
   * (unbiased-Jensen 5.7%, proportional water-filling 6.7%); a deployment-order model fitted to
   * "strongest first" scored 2.0% but is an AUTOMATION's behaviour, not the game's, and reads 12%
   * off when that assumption is dropped. {@link fieldContentionPct} reports the frequency, which
   * needs no such assumption, instead of pretending to a corrected magnitude.
   */
  concurrencyScale: number;
  /**
   * `P(more heroes hold full energy than the field has room for)`, a FRACTION × 100 — how much of
   * the rotation's wall clock is spent with a rested hero benched behind a full field.
   *
   * A DIAGNOSTIC, not a term: nothing multiplies by it. See {@link fieldContentionFraction} for
   * why the frequency is reportable when a correction factor is not. `0` exactly when the field
   * cannot fill.
   */
  fieldContentionPct: number;
  /**
   * `min(FORTUNA_AURA_CAP, Σ (uptime_h × activity_h) × perLevel × level_h)`, a FRACTION.
   *
   * Weighted by the House-ALLOCATED on-field fraction (`uptime_h × activity_h`, the same term
   * `heroesOnField` sums), not the unconstrained `uptime_h` — an aura a hero cannot actually keep
   * on the field cannot be stacking with the others. Phase-dependent because the allocation is
   * (see {@link allocateHouseSlots}); this is why it lives here and not on `SquadFarmFacts`, same
   * as `heroesOnField`/`concurrencyScale`. `sorteFraction` deliberately stays on the unconstrained
   * squad-level basis — see the module header's SORTE-AVERAGE VS FORTUNA-SUM ASYMMETRY note.
   */
  fortunaAura: number;
};

/** `-0` collapses to `0` — never leaks a signed zero into a public field (edge case). */
function normalizeZero(value: number): number {
  return value === 0 ? 0 : value;
}

function buildRow(line: WikiPhaseLine, squad: SquadFarmFacts, options: FarmRateOptions): FarmRateRow {
  const bonus = returnBonusMultiplier(options.returnBonus ?? 'off');
  const sorteMult = 1 + squad.sorteFraction;

  // Per-hero, per-phase: mitigation is the ONLY phase-dependent damage term.
  // `fullTerm` / `fullBossTerm` are UNCONSTRAINED rates — each hero at its own duty cycle, as if
  // the House recovered every hero in parallel. The ceiling is applied to them below.
  const perHero = squad.heroes.map((hero) => {
    const mitF = mitigationFactor(line.mitig, hero.penetrationPct);
    const avgHit = hero.avgHitBase * mitF;
    const eHtk = PROP_SHARES.reduce(
      (sum, prop) => sum + prop.share * hitsToKill(avgHit, propHp(line.hp, prop.hpMult)),
      0,
    );
    const bossHtk = hitsToKill(avgHit, propHp(line.hp, BOSS_HP_MULT_WIKI));
    const hps = hitsPerSec(hero, line.ato);
    return {
      avgHit,
      eHtk,
      fullTerm: (hps * hero.uptime) / eHtk,
      fullBossTerm: (hps * hero.uptime) / bossHtk,
    };
  });

  // Constraint 1 — House recovery slots. Ranked by this phase's own value density, so the
  // strongest hero at THIS mitigation takes a slot ahead of a weaker one.
  const activity = allocateHouseSlots(
    squad.heroes,
    perHero.map((hero) => hero.fullTerm),
    squad.houseSlots,
  );

  let shareDenom = 0;
  let bossRateSum = 0;
  let heroesOnField = 0;
  let fortunaWeightedSum = 0;
  const terms = new Array<number>(perHero.length).fill(0);
  const effectiveUptime = new Array<number>(perHero.length).fill(0);
  for (let i = 0; i < perHero.length; i++) {
    const hero = squad.heroes[i];
    const onField = hero.uptime * activity[i];
    terms[i] = perHero[i].fullTerm * activity[i];
    effectiveUptime[i] = onField;
    shareDenom += terms[i];
    bossRateSum += perHero[i].fullBossTerm * activity[i];
    heroesOnField += onField;
    // House-allocated, not unconstrained: an aura a hero cannot keep on the field cannot stack.
    fortunaWeightedSum += onField * LOOT_ABILITY_VALUES.fortuna.perLevel * hero.fortunaLevel;
  }
  const fortunaAura = Math.min(FORTUNA_AURA_CAP, fortunaWeightedSum);

  // Constraint 2 — field slots, applied to what the House can actually keep fed (never to the
  // unconstrained `uptimeSum`, which would double-charge the same shortage).
  const concurrencyScale = heroesOnField > 0 ? Math.min(1, squad.fieldSlots / heroesOnField) : 1;
  const fieldContention = fieldContentionFraction(effectiveUptime, squad.fieldSlots);

  const propsPerSec = concurrencyScale * shareDenom;
  const bossPerSec = concurrencyScale * bossRateSum;

  const veiaOuroPerLevel = LOOT_ABILITY_VALUES.veia_ouro.perLevel;
  let goldSelfMixSum = 0;
  let expectedHtkSum = 0;
  for (let i = 0; i < perHero.length; i++) {
    const hero = squad.heroes[i];
    const { eHtk } = perHero[i];
    // The House-allocated term, not the unconstrained one: a hero the House cannot keep fed
    // contributes proportionally less to the squad's gold mix, exactly as it does to its rate.
    const share = shareDenom > 0 ? terms[i] / shareDenom : 0;
    const goldSelf = 1 + veiaOuroPerLevel * hero.veiaOuroLevel;
    goldSelfMixSum += share * goldSelf;
    // Guard `0 × Infinity = NaN`: a degenerate hero (eHtk === Infinity) with a genuinely zero
    // share must contribute exactly 0 here, not NaN. `share === 0` already means "this hero adds
    // nothing to the squad's throughput" regardless of what its own (unreachable) eHtk is.
    if (share > 0) expectedHtkSum += share * eHtk;
  }
  const goldSelfMix = shareDenom > 0 ? goldSelfMixSum : 1;
  const expectedHtk = shareDenom > 0 ? expectedHtkSum : Infinity;

  const propCount = propCountForAto(line.ato);
  const clearSecs = propCount / propsPerSec + (line.gate ? 1 / bossPerSec : 0);
  const cyclesPerHour = Number.isFinite(clearSecs) && clearSecs > 0 ? 3600 / clearSecs : 0;

  // A gate cycle is the map PLUS the boss, and the boss drops no props. Deriving the hourly rate
  // from the cycle rather than from `propsPerSec` is what keeps it consistent with `clearSecs` —
  // the boss-free `3600 × propsPerSec` reads up to ~10% high on late gates, and stays positive on
  // a row whose boss the squad cannot kill at all (`clearSecs === Infinity`).
  // Non-gate rows keep the old expression verbatim: algebraically it is the same value, but the
  // rearrangement is not bit-equal in IEEE754 and would churn every row (design.md §2.1).
  const propsPerHour = line.gate ? cyclesPerHour * propCount : 3600 * propsPerSec;

  const eGold = line.goldComum * GOLD_SHARE_FACTOR;
  const goldMult = squad.teamCoinMult * (1 + fortunaAura) * bonus;
  const goldPerHour = propsPerHour * eGold * goldMult * goldSelfMix;

  const chestsPerHour = propsPerHour * DROP_RATES.chest * sorteMult * bonus;
  const keysPerHour = line.gate
    ? -(cyclesPerHour * KEY_GATE_COST)
    : propsPerHour * DROP_RATES.key * sorteMult * bonus;
  const gemsPerHour = line.gate ? propsPerHour * DROP_RATES.gem * sorteMult * bonus : 0;
  const timePiecesPerHour = line.gate ? propsPerHour * DROP_RATES.time * sorteMult * bonus : 0;
  const stoneChestsPerHour = line.gate ? propsPerHour * DROP_RATES.stone * sorteMult * bonus : 0;
  const xpPerHour = propsPerHour * xpPerProp(line.phase) * squad.xpMult * bonus;

  const maxPropHp = line.hp * MAX_PROP_HP_MULT;
  const oneShot = perHero.length > 0 && perHero.every((hero) => hero.avgHit >= maxPropHp);
  const gateTimerSecs = line.gate ? (GATE_SECS_POR_ATO[line.ato - 1] ?? null) : null;
  const infeasible =
    (line.gate && gateTimerSecs != null && clearSecs > gateTimerSecs) ||
    !Number.isFinite(clearSecs) ||
    propsPerSec <= 0;
  const locked = options.maxPhase != null && line.phase > options.maxPhase;

  const itemLevels = itemLevelsForPhase(line.phase);

  return {
    phase: line.phase,
    ato: line.ato,
    gate: line.gate,
    locked,
    mitigationPct: line.mitig * 100,
    goldPerHour: normalizeZero(goldPerHour),
    chestsPerHour: normalizeZero(chestsPerHour),
    keysPerHour: normalizeZero(keysPerHour),
    gemsPerHour: normalizeZero(gemsPerHour),
    timePiecesPerHour: normalizeZero(timePiecesPerHour),
    stoneChestsPerHour: normalizeZero(stoneChestsPerHour),
    xpPerHour: normalizeZero(xpPerHour),
    propsPerHour: normalizeZero(propsPerHour),
    cyclesPerHour: normalizeZero(cyclesPerHour),
    clearSecs,
    gateTimerSecs,
    oneShot,
    infeasible,
    itemLevels,
    itemLevelLabel: itemLevelDropLabel(itemLevels),
    jaulaEarlyCapPct: jaulaEarlyCap(line.phase) * 100,
    jaulaWindowSecs: JAULA.janelaSecs,
    expectedHtk,
    heroesOnField: normalizeZero(heroesOnField),
    concurrencyScale,
    fieldContentionPct: normalizeZero(fieldContention * 100),
    fortunaAura: normalizeZero(fortunaAura),
  };
}

/** `null` for any phase outside `[1, WIKI_PHASE_LINES.length]`, non-integer, or `NaN`. Never clamps. */
function isValidPhase(phase: number): boolean {
  return Number.isInteger(phase) && phase >= 1 && phase <= WIKI_PHASE_LINES.length;
}

/** `null` for any phase outside `[1, WIKI_PHASE_LINES.length]` or without a wiki line. */
export function computeFarmRateRow(
  phase: number,
  squad: SquadFarmFacts,
  options: FarmRateOptions = {},
): FarmRateRow | null {
  if (!isValidPhase(phase)) return null;
  const line = WIKI_PHASE_LINES[phase - 1];
  if (!line) return null;
  return buildRow(line, squad, options);
}

/** All 600 wiki phases, ascending. Zero pipeline calls. */
export function computeFarmRateTable(squad: SquadFarmFacts, options: FarmRateOptions = {}): FarmRateRow[] {
  return WIKI_PHASE_LINES.map((line) => buildRow(line, squad, options));
}

/** Convenience for item C: facts + squad + table in one call. See {@link computeHeroFarmBases}
 *  for the pipeline-call count (`2N`, or `N` when `account.teamBuffsOverride` is set). */
export function computeFarmRates(
  input: FarmFactsInput & FarmRateOptions,
): { heroFacts: HeroFarmFacts[]; squad: SquadFarmFacts; rows: FarmRateRow[] } {
  const heroFacts = computeHeroFarmFacts(input);
  const squad = computeSquadFarmFacts(heroFacts, input.account);
  const rows = computeFarmRateTable(squad, { returnBonus: input.returnBonus, maxPhase: input.maxPhase });
  return { heroFacts, squad, rows };
}
