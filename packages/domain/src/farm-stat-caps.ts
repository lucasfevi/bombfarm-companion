/**
 * Moves and seeds that land a stat exactly on its cap in one step.
 *
 * The farm search transfers points in blocks of at most fifty, and gold per hour only moves at
 * whole hits-to-kill steps. Reaching a cap usually means moving far more than that out of
 * several stats at once, and every block on the way loses damage before the cap pays — so each
 * one was refused and the descent never got there. Measured 2026-10-31 on a nine-hero squad at
 * phase 301: the player's own capped builds (crit chance at the aura ceiling, cooldown 40-80%)
 * farmed +11% gold per hour over the search's proposal, which held no cooldown points at all.
 */
import {
  FUSE_CYCLE_OVERHEAD_SEC,
  GRID_SPEED_COEF,
  STAT_CAPS,
  freeHopCells,
  fuseHopFactor,
  fuseSeconds,
  hopSpeedFactor,
  walkCycleOverheadSeconds,
} from './model';
import { buildCandidateSheet, RESPEC_KEYS, zeroedRespecKeys } from './points-reopt-core';
import { critCeilingOfBasis, type HeroFarmBasis } from './farm-rate';
import type { SheetKey } from './planner-constants';

export const CAPPED_KEYS = ['critChance', 'cdr', 'penetration'] as const;
export type CappedKey = (typeof CAPPED_KEYS)[number];

/** The most of what remains a cap-first seed spends on any one cap, so a cap the budget can
 *  barely reach still leaves points for damage. */
export const CAP_SEED_MAX_SHARE = 0.6;

/** Crit chance caps where the team's Presságio aura at full presence tops it up to 100, which is
 *  what the basis's crit ceiling already says. */
export function capOf(basis: HeroFarmBasis, key: CappedKey): number {
  if (key !== 'critChance') return STAT_CAPS[key];
  return Math.min(STAT_CAPS.critChance, critCeilingOfBasis(basis) ?? STAT_CAPS.critChance);
}

/**
 * Whole points between `pts` and `key`'s cap: positive is the fewest that reach it, negative the
 * most that can come off without dropping below it, `null` when a point buys nothing on `key`.
 * Exact because the candidate sheet is affine in the points.
 */
export function pointsToCap(basis: HeroFarmBasis, pts: Record<SheetKey, number>, key: CappedKey): number | null {
  const perPoint = basis.effectiveDelta[key];
  if (!(perPoint > 0)) return null;
  const value = buildCandidateSheet(basis.effective, basis.pts, basis.effectiveDelta, pts)[key];
  const gap = (capOf(basis, key) - value) / perPoint;
  return gap > 1e-9 ? Math.ceil(gap - 1e-9) : 0 - Math.floor(-gap + 1e-9);
}

type CapMoveFn = (pts: Record<SheetKey, number>, unplaced: number) => Record<SheetKey, number> | null;

function drainLargestFirst(
  pts: Record<SheetKey, number>,
  amount: number,
  keep: ReadonlySet<SheetKey>,
): Record<SheetKey, number> | null {
  const out = { ...pts };
  const donors = RESPEC_KEYS.filter((key) => !keep.has(key) && out[key] > 0).sort((a, b) => out[b] - out[a]);
  let left = amount;
  for (const key of donors) {
    if (left <= 0) break;
    const take = Math.min(out[key], left);
    out[key] -= take;
    left -= take;
  }
  return left > 0 ? null : out;
}

/**
 * Per capped key the hero can still buy into: fill from unplaced points, from each single donor,
 * or from every uncapped stat largest first; and the points past a cap, which score nothing,
 * onto each destination. Built per hero because the cap distance reads the hero's own sheet.
 */
export function generateCapMoves(basis: HeroFarmBasis, destinations: readonly SheetKey[]): CapMoveFn[] {
  const moves: CapMoveFn[] = [];
  const cappedSet = new Set<SheetKey>(CAPPED_KEYS);
  for (const key of CAPPED_KEYS) {
    if (!destinations.includes(key)) continue;
    const fromPool = (pts: Record<SheetKey, number>, unplaced: number) => {
      const need = pointsToCap(basis, pts, key);
      return need === null || need <= 0 ? null : { need, fromBank: Math.min(need, unplaced) };
    };
    moves.push((pts, unplaced) => {
      const fill = fromPool(pts, unplaced);
      return fill && fill.fromBank === fill.need ? { ...pts, [key]: pts[key] + fill.need } : null;
    });
    moves.push((pts, unplaced) => {
      const fill = fromPool(pts, unplaced);
      if (!fill || fill.fromBank === fill.need) return null;
      const drained = drainLargestFirst(pts, fill.need - fill.fromBank, cappedSet);
      return drained && { ...drained, [key]: drained[key] + fill.need };
    });
    for (const from of RESPEC_KEYS) {
      if (from === key) continue;
      moves.push((pts, unplaced) => {
        const fill = fromPool(pts, unplaced);
        if (!fill) return null;
        const take = fill.need - fill.fromBank;
        if (take === 0 || pts[from] < take) return null;
        return { ...pts, [from]: pts[from] - take, [key]: pts[key] + fill.need };
      });
    }
    for (const destination of destinations) {
      if (destination === key) continue;
      moves.push((pts) => {
        const distance = pointsToCap(basis, pts, key);
        const excess = distance === null ? 0 : Math.min(-distance, pts[key]);
        return excess < 1 ? null : { ...pts, [key]: pts[key] - excess, [destination]: pts[destination] + excess };
      });
    }
  }
  return moves;
}

export type CapSeedShape = {
  /** Cooldown is bought after crit chance, or not at all. */
  cdr: boolean;
  /** Speed is bought until the hero walks its next hop inside one fuse. */
  speed: boolean;
  /** Only a young account's heroes are short of field time; past that energy buys nothing. */
  energyShare: number;
  /** What crit damage takes of the points left after the caps, speed and energy; attack takes the rest. */
  critDmgShare: number;
};

/** Standing props the walk is judged at: mid-wave on a full map. */
const BALANCE_STANDING_PROPS = 50;

function walksInsideFuse(basis: HeroFarmBasis, pts: Record<SheetKey, number>): boolean {
  const sheet = buildCandidateSheet(basis.effective, basis.pts, basis.effectiveDelta, pts);
  const fuse = fuseSeconds(sheet.cdr);
  const walkSpeed = sheet.speed * GRID_SPEED_COEF;
  if (!(walkSpeed > 0)) return false;
  const hop = freeHopCells(BALANCE_STANDING_PROPS) * hopSpeedFactor(walkSpeed) * fuseHopFactor(fuse);
  return hop / walkSpeed + walkCycleOverheadSeconds(fuse) <= fuse + FUSE_CYCLE_OVERHEAD_SEC;
}

/**
 * The fewest speed points, up to `limit`, at which the hero reaches its next target before the
 * bomb it just planted goes off — plant, walk on while it burns, plant again. Past that a cycle
 * waits on the fuse and more speed buys little; short of it the hero stands idle on the walk.
 */
export function speedPointsToWalkInsideFuse(basis: HeroFarmBasis, pts: Record<SheetKey, number>, limit: number): number {
  if (!(basis.effectiveDelta.speed > 0) || walksInsideFuse(basis, pts)) return 0;
  let low = 0;
  let high = Math.max(0, Math.floor(limit));
  if (!walksInsideFuse(basis, { ...pts, speed: pts.speed + high })) return high;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (walksInsideFuse(basis, { ...pts, speed: pts.speed + mid })) high = mid;
    else low = mid;
  }
  return high;
}

/**
 * One hero built cap first from zero: crit chance to its ceiling, then cooldown, then speed to
 * walk inside the fuse — each held to {@link CAP_SEED_MAX_SHARE} of what remains — then energy,
 * then crit damage and attack.
 */
export function capFirstPts(basis: HeroFarmBasis, budget: number, shape: CapSeedShape): Record<SheetKey, number> {
  const pts = zeroedRespecKeys(basis.pts);
  let remaining = budget;
  const order: CappedKey[] = shape.cdr ? ['critChance', 'cdr'] : ['critChance'];
  for (const key of order) {
    const need = pointsToCap(basis, pts, key);
    if (need === null || need <= 0) continue;
    const spend = Math.min(need, Math.floor(remaining * CAP_SEED_MAX_SHARE));
    pts[key] += spend;
    remaining -= spend;
  }
  if (shape.speed) {
    const speed = speedPointsToWalkInsideFuse(basis, pts, Math.floor(remaining * CAP_SEED_MAX_SHARE));
    pts.speed += speed;
    remaining -= speed;
  }
  const energy = Math.round(remaining * shape.energyShare);
  const critDmg = Math.round((remaining - energy) * shape.critDmgShare);
  pts.energy += energy;
  pts.critDmg += critDmg;
  pts.attack += remaining - energy - critDmg;
  return pts;
}
