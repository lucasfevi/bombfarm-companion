/**
 * How long a squad takes to clear one map: an integral over the props still standing, not a
 * constant rate. Every rate below depends on `n`, the number of props left, because the field
 * behaves differently at 90 props and at 5 — and 30% of a clear is spent under 10.
 *
 * Measured on two accounts farming the same 100-prop phase (frames at 5/s on one, the bot's
 * standing-prop log at ~1/s on both; captures held out of band, not in this repo):
 *
 * - **Hits per plant grow with density.** A blast cross covers `blastCells` cells; the props it
 *   lands on scale with `n / 304`. Heroes plant next to clusters, so the slope runs ~1.25× the
 *   uniform expectation, and it saturates near 0.37 hits per cross cell.
 * - **A plant can miss.** When the targeted prop dies to someone else before the fuse ends, the
 *   bomb hits nothing. Under 10 props a 13-cell cross averaged 0.96 hits per plant. The chance
 *   grows with the per-prop kill rate over the fuse, which is why more damage buys less than a
 *   linear model says.
 * - **Hits-to-kill rolls the crit per hit.** The game does not deal the crit-averaged hit; it
 *   deals a normal hit or a crit. A hero whose average hit one-shots a prop still needs ~1.5
 *   hits when only the crit does — measured 1.92 hits per kill on a field the averaged hit priced
 *   at 1.27 ({@link expectedHitsToKill}).
 * - **Hops depend on `n` and on re-planting.** The free hop between props runs
 *   `4.5 + 13 / sqrt(n)` cells; a hero re-bombing a prop that survived its last hit hops ~1 cell.
 *   The cycle is `max(fuse + overhead, hop / w + overhead)`, fuse-bound on a full field.
 * - **The tail is starved, not slow.** Under ~5 props only `1.9 n + 1.5` heroes have a target;
 *   the rest walk. The last prop still gets three or four bombers.
 * - **The head walks in.** Nothing dies for the first ~3 s (activation stagger plus the first
 *   fuse), and the first ten kills come at a reduced rate while heroes cross the map from
 *   wherever the last wave ended.
 * - **Easy props die first.** Hits land uniformly over standing props, so a type needing fewer
 *   hits depletes faster and the tail is the tough mix. Tracked per type, no constant.
 *
 * Two structural pieces earn a sentence each. The miss term uses the previous step's kill rate
 * (`kPrev`), an implicit equation solved by lagging one prop, which is exact in the limit and
 * within 1% at 100 steps. The integration walks one prop at a time so the last prop is priced at
 * the `n = 1` rate — integrating a fractional count to zero would take logarithmic, unbounded time.
 */

/** Playable cells of the battlefield grid (19 × 16). */
export const GRID_CELLS = 304;

/** Hits one plant lands on an otherwise empty field: the targeted prop, less the miss chance. */
export const HITS_PER_PLANT_BASE = 1.6;
/** Cluster seeking: props under a cross over the uniform `cells × n / GRID_CELLS` expectation. */
export const HITS_PER_PLANT_CLUSTER = 1.5;
/**
 * Hits per plant saturate at `HITS_PER_PLANT_CAP_BASE + HITS_PER_PLANT_CAP_PER_CELL × cells`:
 * ~4.8 for a 13-cell cross and ~2.9 for a 5-cell one on a full map. A narrow cross saturates
 * proportionally higher than a wide one because the targeted prop's neighbours are its whole
 * reach; a wide cross also covers cells that are empty on any map.
 */
export const HITS_PER_PLANT_CAP_BASE = 1.8;
export const HITS_PER_PLANT_CAP_PER_CELL = 0.23;

/** Seconds a fuse-bound cycle spends beyond the fuse itself (clearing the cross, re-targeting). */
export const FUSE_CYCLE_OVERHEAD_SEC = 0.55;
/** Seconds a walk-bound cycle spends beyond the walk itself — the retreat out of the cross,
 *  measured at ~0.25 s and independent of blast reach. */
export const WALK_CYCLE_OVERHEAD_SEC = 0.2;
/** Free hop between props, cells: `FREE_HOP_BASE + FREE_HOP_SQRT / sqrt(n)`. */
export const FREE_HOP_BASE_CELLS = 4.5;
export const FREE_HOP_SQRT_CELLS = 13;
/** Hop when re-bombing the prop that survived the last hit, cells. */
export const REPLANT_HOP_CELLS = 1;

/** Seconds from the wave start to the first kill: activation stagger plus one fuse. */
export const FIRST_KILL_SEC = 3.0;
/** The kill rate the head starts at, as a share of steady state, ramping to 1 over `HEAD_RAMP_PROPS`. */
export const HEAD_RAMP_START = 0.4;
export const HEAD_RAMP_PROPS = 10;
/** The first hop of a wave, cells — heroes cross the map from where the last wave ended. */
export const HEAD_HOP_CELLS = 10;

/** Heroes with a target on a starved field: `ACTIVE_PER_PROP × n + ACTIVE_EXTRA`, capped at the squad. */
export const ACTIVE_PER_PROP = 1.9;
export const ACTIVE_EXTRA = 1.5;

/** Standing props per prop killed in one integration step; under this many, one prop per step. */
const COARSE_STEP_ABOVE = 20;

/** Above this many hits the crit-averaged hit is exact to under 1% (central limit) and cheaper. */
const CRIT_ROLL_MAX_HITS = 60;

export type ClearHero = {
  /** Expected share of wall clock this hero stands on the field, 0..1. */
  presence: number;
  fuseSecs: number;
  /** Cells per second. */
  walkSpeedCells: number;
  /** Cells a blast covers: `1 + 4 × blastRange` for a plus-shaped cross. */
  blastCells: number;
  /** The NON-CRIT hit, after phase mitigation and any field-wide multiplier. */
  hitNoCrit: number;
  /** 0..1. */
  critChance: number;
  /** A crit deals `hitNoCrit × critMult`. */
  critMult: number;
};

export type ClearPropType = {
  hp: number;
  /** Spawn weight; the map opens with `propCount × weight / Σ weight` of this type. */
  weight: number;
};

export type ClearResult = {
  /** Wave start to last prop, seconds. `Infinity` when nobody can kill anything. */
  clearSecs: number;
  /** Hits landed per prop killed, over the whole clear. `Infinity` with `clearSecs`. */
  expectedHtk: number;
  /** Each hero's share of the kills, in `heroes` order, summing to 1; all zero with `clearSecs`. */
  killShareByHero: readonly number[];
};

export const UNCLEARABLE: ClearResult = Object.freeze({
  clearSecs: Infinity,
  expectedHtk: Infinity,
  killShareByHero: Object.freeze([]),
});

function unclearable(heroCount: number): ClearResult {
  return heroCount === 0 ? UNCLEARABLE : { clearSecs: Infinity, expectedHtk: Infinity, killShareByHero: new Array<number>(heroCount).fill(0) };
}

/**
 * Expected hits until accumulated damage reaches `hp`, rolling the crit on every hit.
 *
 * `E[hits] = Σ_k P(alive after k hits)`, and the prop is alive after `k` hits while fewer than
 * `c*(k) = ceil((hp − k × hit) / (crit − hit))` of them were crits, so each term is a binomial
 * lower tail. Exact, and cheap: at most `ceil(hp / hit)` terms. Past {@link CRIT_ROLL_MAX_HITS}
 * the sum is replaced by `hp / E[hit]`, which the central limit theorem makes accurate there.
 */
export function expectedHitsToKill(hp: number, hitNoCrit: number, critChance: number, critMult: number): number {
  if (!(hitNoCrit > 0) || !Number.isFinite(hitNoCrit)) return Infinity;
  if (!(hp > 0)) return 0;
  const p = Math.min(1, Math.max(0, critChance));
  const crit = hitNoCrit * Math.max(1, critMult);
  if (p >= 1) return Math.ceil(hp / crit);
  const maxHits = Math.ceil(hp / hitNoCrit);
  if (p <= 0 || crit <= hitNoCrit) return maxHits;
  if (maxHits > CRIT_ROLL_MAX_HITS) return hp / ((1 - p) * hitNoCrit + p * crit);

  // Summed by crit count instead of by hit count: with exactly `c` crits the prop survives `k`
  // hits while `k < K_c = ceil((hp − c × crit) / hit) + c`, and `c` runs only to the crits that
  // kill on their own — a handful, since a crit is several hits. Each `P(k hits, c crits)` is
  // the previous one times `q × (k + 1) / (k + 1 − c)`, so the whole sum is a few hundred
  // multiplications where the by-hit form was a few thousand.
  const q = 1 - p;
  let expected = 0;
  let firstTerm = 1;
  for (let c = 0; ; c++) {
    const hitsWithCrits = Math.ceil((hp - c * crit) / hitNoCrit - 1e-12);
    if (hitsWithCrits <= 0) break;
    const survivesBelow = hitsWithCrits + c;
    // `firstTerm` is P(the first c hits are all crits) = p^c; walking k up from c multiplies in
    // the non-crits and the binomial coefficient.
    let pmf = firstTerm;
    for (let k = c; k < survivesBelow; k++) {
      if (k > c) pmf *= (q * k) / (k - c);
      expected += pmf;
    }
    firstTerm *= p;
    if (firstTerm < 1e-15) break;
  }
  return expected;
}

/**
 * Seconds to clear `propCount` props with this squad, and the hits it took per kill.
 *
 * `heroes` carry their presence (the House and field-queue models decide it; this function does
 * not), their cadence inputs and their hit at THIS phase. `props` is the spawn mix with each
 * type's HP at this phase.
 */
export function simulateClear(
  heroes: readonly ClearHero[],
  props: readonly ClearPropType[],
  propCount: number,
): ClearResult {
  if (!(propCount > 0) || props.length === 0) {
    return { clearSecs: FIRST_KILL_SEC, expectedHtk: 0, killShareByHero: new Array<number>(heroes.length).fill(0) };
  }
  const weightSum = props.reduce((sum, prop) => sum + Math.max(0, prop.weight), 0);
  if (!(weightSum > 0)) return unclearable(heroes.length);

  const activeIndex: number[] = [];
  heroes.forEach((hero, index) => {
    if (hero.presence > 0 && hero.hitNoCrit > 0 && hero.walkSpeedCells > 0) activeIndex.push(index);
  });
  const active = activeIndex.map((index) => heroes[index]);
  if (active.length === 0) return unclearable(heroes.length);
  const squad = active.reduce((sum, hero) => sum + hero.presence, 0);

  const hitsToKill = active.map((hero) =>
    props.map((prop) => expectedHitsToKill(prop.hp, hero.hitNoCrit, hero.critChance, hero.critMult)),
  );
  if (hitsToKill.every((row) => row.every((hits) => !Number.isFinite(hits)))) return unclearable(heroes.length);

  const counts = props.map((prop) => (propCount * Math.max(0, prop.weight)) / weightSum);
  const heroCount = active.length;
  const typeCount = props.length;
  // Per-hero scratch, allocated once: the plant rate, the density part of hits per plant, the
  // hit-per-plant cap, and `killsPerHit[h] = Σ_t share_t / hits[h][t]` for the standing mix.
  const plantRate = new Array<number>(heroCount).fill(0);
  const hitsPerPlantFull = new Array<number>(heroCount).fill(0);
  const hitsPerPlantCap = active.map((hero) => HITS_PER_PLANT_CAP_BASE + HITS_PER_PLANT_CAP_PER_CELL * hero.blastCells);
  const fuseBound = active.map((hero) => hero.fuseSecs + FUSE_CYCLE_OVERHEAD_SEC);
  const replantCycle = active.map((hero, h) =>
    Math.max(fuseBound[h], REPLANT_HOP_CELLS / hero.walkSpeedCells + WALK_CYCLE_OVERHEAD_SEC),
  );
  const killsPerHit = new Array<number>(heroCount).fill(0);
  const heroHits = new Array<number>(heroCount).fill(0);
  const killsByHero = new Array<number>(heroCount).fill(0);
  const meanFuse = active.reduce((sum, hero) => sum + hero.presence * hero.fuseSecs, 0) / squad;
  const killShare = new Array<number>(typeCount).fill(0);
  const share = new Array<number>(typeCount).fill(0);
  // The types still standing, so the tail — where only a few tough types remain — loops over
  // those alone.
  const standingTypes = new Array<number>(typeCount).fill(0);
  let standingCount = 0;
  // `1 / hits`, once: the inner loops multiply, they never divide. A type this hero cannot kill
  // reads 0 kills per hit, which is what `1 / Infinity` says.
  const killsPerHitByType = hitsToKill.map((row) => row.map((hits) => 1 / hits));
  let seconds = FIRST_KILL_SEC;
  let hitsLanded = 0;
  let killed = 0;
  let killRatePrev = 0;

  // One prop per step under `COARSE_STEP_ABOVE` standing, where the rates move fastest and the
  // last prop must be priced at the `n = 1` rate; `n / COARSE_STEP_ABOVE` props per step on a
  // fuller map, with the rates read at the step's midpoint. The step is continuous in the count
  // (never rounded), so the clear is a smooth function of every input. The bound only guards a
  // mix that never empties.
  for (let step = 0; step < 2 * propCount + 10; step++) {
    let standing = 0;
    for (let t = 0; t < typeCount; t++) standing += counts[t];
    if (standing < 0.5) break;
    standingCount = 0;
    for (let t = 0; t < typeCount; t++) {
      share[t] = counts[t] / standing;
      if (counts[t] > 0) standingTypes[standingCount++] = t;
    }
    const chunk = Math.min(standing, Math.max(1, standing / COARSE_STEP_ABOVE));
    const n = Math.max(1, standing - (chunk - 1) / 2);
    const propsKilled = propCount - n;

    let freeHop = FREE_HOP_BASE_CELLS + FREE_HOP_SQRT_CELLS / Math.sqrt(n);
    let activeShare = Math.min(1, (ACTIVE_PER_PROP * n + ACTIVE_EXTRA) / squad);
    if (propsKilled < HEAD_RAMP_PROPS) {
      const ramp = Math.max(0, propsKilled) / HEAD_RAMP_PROPS;
      freeHop = Math.max(freeHop, HEAD_HOP_CELLS * (1 - ramp) + freeHop * ramp);
      activeShare *= HEAD_RAMP_START + (1 - HEAD_RAMP_START) * ramp;
    }
    const densityHits = (HITS_PER_PLANT_CLUSTER * n) / GRID_CELLS;

    // Per-hero cadence at this density; only the miss term depends on the kill rate itself.
    for (let h = 0; h < heroCount; h++) {
      const hero = active[h];
      const hits = hitsToKill[h];
      const perTypeKills = killsPerHitByType[h];
      let mixHits = 0;
      let perHit = 0;
      for (let i = 0; i < standingCount; i++) {
        const t = standingTypes[i];
        mixHits += share[t] * hits[t];
        perHit += share[t] * perTypeKills[t];
      }
      killsPerHit[h] = perHit;
      const replantShare = Number.isFinite(mixHits) ? Math.max(0, 1 - 1 / mixHits) : 1;
      // The mean of the two cycles, not the cycle of the mean hop: a prop that needs `E` hits
      // costs one free-hop cycle and `E − 1` re-plant cycles, so the time per kill is
      // `C_free + (E − 1) × C_replant`, which never falls as the hit grows.
      const freeCycle = Math.max(fuseBound[h], freeHop / hero.walkSpeedCells + WALK_CYCLE_OVERHEAD_SEC);
      const cycle = (1 - replantShare) * freeCycle + replantShare * replantCycle[h];
      plantRate[h] = (hero.presence * activeShare) / cycle;
      hitsPerPlantFull[h] = densityHits * (hero.blastCells - 1);
    }

    // The miss term is a fixed point — plants miss because of the kill rate the plants produce.
    // Solved by damped iteration from the previous step's rate: three passes put it within 0.1%
    // and keep the rate monotone in damage, which a lagged reading alone does not. One
    // exponential per pass, at the squad's mean fuse, with a first-order correction per hero —
    // fuses sit within ~0.2 s of each other, so the correction is under 0.1%.
    let killRate = 0;
    let hitRate = 0;
    let missBasis = killRatePrev;
    for (let pass = 0; pass < 3; pass++) {
      killRate = 0;
      hitRate = 0;
      const perProp = missBasis / n;
      const surviveMean = Math.exp(-perProp * meanFuse);
      for (let h = 0; h < heroCount; h++) {
        const miss = 1 - surviveMean * (1 - perProp * (active[h].fuseSecs - meanFuse));
        const hitsPerPlant = Math.min(HITS_PER_PLANT_BASE * (1 - miss) + hitsPerPlantFull[h], hitsPerPlantCap[h]);
        heroHits[h] = plantRate[h] * hitsPerPlant;
        hitRate += heroHits[h];
        killRate += heroHits[h] * killsPerHit[h];
      }
      missBasis = (missBasis + killRate) / 2;
    }
    if (!(killRate > 0)) return unclearable(heroes.length);

    killShare.fill(0);
    for (let h = 0; h < heroCount; h++) {
      const perTypeKills = killsPerHitByType[h];
      const hitsNow = heroHits[h];
      for (let i = 0; i < standingCount; i++) {
        const t = standingTypes[i];
        killShare[t] += hitsNow * share[t] * perTypeKills[t];
      }
    }

    const dt = chunk / killRate;
    seconds += dt;
    hitsLanded += hitRate * dt;
    killed += chunk;
    for (let h = 0; h < heroCount; h++) killsByHero[h] += heroHits[h] * killsPerHit[h] * dt;
    for (let t = 0; t < typeCount; t++) {
      counts[t] = Math.max(0, counts[t] - (chunk * killShare[t]) / killRate);
    }
    killRatePrev = killRate;
  }

  const killShareByHero = new Array<number>(heroes.length).fill(0);
  if (killed > 0) {
    const total = killsByHero.reduce((sum, kills) => sum + kills, 0);
    for (let h = 0; h < heroCount; h++) killShareByHero[activeIndex[h]] = total > 0 ? killsByHero[h] / total : 0;
  }
  return { clearSecs: seconds, expectedHtk: killed > 0 ? hitsLanded / killed : Infinity, killShareByHero };
}
