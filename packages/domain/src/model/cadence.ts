/**
 * Per-hero bombs/s, read off the same clear integral the Farm board prices a map with
 * (`clear-time.ts`), so the two cannot disagree about how fast a hero plants.
 *
 * A per-hero figure has no squad, so the hero is priced as one of {@link REFERENCE_FIELD_HEROES}
 * copies of itself clearing the band's props. That keeps everything the field does to a cycle —
 * hops shortening as the map fills, the head walked in, a starved tail where most of the field has
 * nothing to bomb — and leaves out only what the hero's damage would change about the field's
 * pace, which {@link REFERENCE_HITS_TO_KILL} fixes. Fuse, walk speed and band are the only inputs.
 *
 * Validated against two accounts' nine-hero fields at the same 100-prop band: plants per second on
 * the field land within ~15% for most heroes and within 20% for all 22, the accounts' means off
 * by −5% and +10%. The same captures price the cooldown cap at ×1.34–1.36 over today's fuses when
 * each measured cycle keeps its own hop; this reads ×1.23 for a `w = 3.4` hero.
 */
import { PROPS_POR_ATO, propCountForAto } from '../phase-wiki';
import { simulateClear } from './clear-time';

export const REFERENCE_FIELD_HEROES = 9;

/** A rank-20 Wide Blast cross, which every hero on both measured fields carried or near it. */
export const REFERENCE_BLAST_CELLS = 13;

/**
 * Hits each prop takes in the reference field. The two measured fields needed 2.4 and 5.9; the
 * per-hero rate moves by ~2% across that range, because hits-to-kill reaches the cycle only
 * through how long the field spends starved.
 */
export const REFERENCE_HITS_TO_KILL = 4;

/** The band a cycle is priced at when the caller names none: the first, 50 props. */
export const FIRST_ATO = 1;

/** Clamped exactly as `propCountForAto` clamps, so the two never disagree on an out-of-range ato. */
export function atoIndex(ato: number): number {
  return Math.max(1, Math.min(PROPS_POR_ATO.length, Math.round(ato))) - 1;
}

const REFERENCE_PROP = Object.freeze([{ hp: 1, weight: 1 }]);
// Just over `1 / hits`, so the last hit always kills despite rounding.
const REFERENCE_HIT = (1 + 1e-9) / REFERENCE_HITS_TO_KILL;

// A clear costs ~12 µs and the optimizers price the same few sheets thousands of times.
const CYCLE_CACHE_LIMIT = 8192;
const cycleCache = new Map<string, number>();

/**
 * Seconds per bomb over a whole clear of the band's props, head and starved tail included.
 * `Infinity` when the hero cannot move, which keeps a degenerate hero at zero throughput.
 */
export function cycleSecondsForHero(fuseSecs: number, walkSpeedCells: number, ato: number = FIRST_ATO): number {
  if (!(walkSpeedCells > 0) || !Number.isFinite(walkSpeedCells)) return Infinity;
  const key = `${fuseSecs}|${walkSpeedCells}|${atoIndex(ato)}`;
  const cached = cycleCache.get(key);
  if (cached !== undefined) return cached;
  if (cycleCache.size >= CYCLE_CACHE_LIMIT) cycleCache.clear();
  const cycle = referenceFieldCycle(fuseSecs, walkSpeedCells, ato);
  cycleCache.set(key, cycle);
  return cycle;
}

function referenceFieldCycle(fuseSecs: number, walkSpeedCells: number, ato: number): number {
  const clear = simulateClear(
    [
      {
        presence: REFERENCE_FIELD_HEROES,
        fuseSecs,
        walkSpeedCells,
        blastCells: REFERENCE_BLAST_CELLS,
        hitNoCrit: REFERENCE_HIT,
        critChance: 0,
        critMult: 1,
      },
    ],
    REFERENCE_PROP,
    propCountForAto(ato),
  );
  const rate = clear.plantRateByHero[0] ?? 0;
  return rate > 0 ? 1 / rate : Infinity;
}
