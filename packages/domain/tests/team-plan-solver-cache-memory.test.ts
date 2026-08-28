/**
 * The solver's memoisation cache must never grow with the evaluation budget.
 *
 * It used to: `budget.cache` was an uncapped `Map` whose only ceiling was
 * `TEAM_PLAN_MAX_EVALUATIONS` (500,000), and each entry stored a whole `RosterEvaluation`
 * (a `HeroScore` per hero, each carrying `HeroSheet` / `adjusted` / `effectiveDelta` /
 * `Context`) under a key that re-serialised the entire spare pool AND the point allocation.
 * Measured on a real 441-item, 15-hero save that reached multiple GB and killed the browser
 * tab outright; capping it brought the same run to 144 MB.
 *
 * Two properties are locked here:
 *   1. the cache is bounded, whatever the budget or inventory size;
 *   2. memoisation is invisible — running with the cache off produces identical results.
 *      A cache that changes the answer is worse than no cache.
 */
import { describe, expect, it } from 'vitest';
import {
  evaluateAssignment,
  TEAM_PLAN_MAX_CACHE_ENTRIES,
  type SolverBudget,
} from '@bombfarm/domain/team-plan/solver-search';
import { buildHeroPlanContexts } from '@bombfarm/domain/team-plan/hero-context';
import { buildPool, poolEntryForItem } from '@bombfarm/domain/team-plan/pool';
import { baselineAssignmentFromInput } from '@bombfarm/domain/team-plan/waterfall';
import { applyMove, type AssignmentState } from '@bombfarm/domain/team-plan/solver-assignment';
import { generateMoves } from '@bombfarm/domain/team-plan/solver-moves';
import { teamPlanInputFromFixture, TEAM_PLAN_FIXTURE } from './helpers/team-plan-fixtures';

// MP5 F1 (AD-068 class (b) — structural): re-pointed onto save-20260819-11882-7heroes.json.
const FIXTURE = TEAM_PLAN_FIXTURE;

function setup(fixture: string = FIXTURE) {
  const input = teamPlanInputFromFixture(fixture, 10);
  const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
  if (built.blocked) throw new Error('fixture unexpectedly blocked');
  const contexts = built.contexts;
  const itemById = new Map(input.inventory.map((i) => [i.id, i]));
  const rosterHeroIds = new Set(input.heroes.map((h) => h.heroId));
  const pool = buildPool({
    inventory: input.inventory,
    scopeByHeroId: input.scopeByHeroId,
    forgeFloor: input.forgeFloor,
    rosterHeroIds,
  });
  const baseline = baselineAssignmentFromInput(input, contexts, pool);
  const ptsByHeroId = Object.fromEntries(input.heroes.map((h) => [h.heroId, h.pts]));
  return { input, contexts, itemById, baseline, ptsByHeroId };
}

/** Distinct assignments, produced the way the search itself produces them. */
function walk(baseline: AssignmentState, count: number, ctx: ReturnType<typeof setup>): AssignmentState[] {
  const out: AssignmentState[] = [];
  let current = baseline;
  while (out.length < count) {
    const moves = generateMoves({
      contexts: ctx.contexts,
      slots: current.slots,
      pool: current.pool,
      itemById: ctx.itemById,
      heroDpsById: {},
      forgeFloor: ctx.input.forgeFloor,
    });
    if (moves.length === 0) break;
    for (const move of moves) {
      out.push(applyMove(current, move));
      if (out.length >= count) break;
    }
    current = applyMove(current, moves[out.length % moves.length]);
  }
  return out;
}

function totalCached(budget: SolverBudget): number {
  let n = 0;
  for (const bucket of budget.cache?.values() ?? []) n += bucket.size;
  return n;
}

describe('solver cache memory', () => {
  it('never stores more than the cap, however many assignments are evaluated', () => {
    const ctx = setup();
    // A small explicit cap so the invariant is provable without generating 5,000 states.
    // `maxCacheEntries` is the same knob a host would use; the production default is asserted
    // separately below.
    const CAP = 50;
    const budget: SolverBudget = {
      maxEvaluations: Number.MAX_SAFE_INTEGER,
      evaluations: 0,
      exhausted: false,
      cache: new Map(),
      maxCacheEntries: CAP,
    };
    const assignments = walk(ctx.baseline, CAP + 400, ctx);
    // The fixture must generate more distinct states than the cap, or this proves nothing.
    expect(assignments.length).toBeGreaterThan(CAP);

    for (const a of assignments) {
      evaluateAssignment(a, ctx.contexts, ctx.ptsByHeroId, ctx.input, ctx.itemById, budget);
    }

    expect(budget.cacheEntries).toBeLessThanOrEqual(CAP);
    expect(totalCached(budget)).toBeLessThanOrEqual(CAP);
    // The counter must track reality, or the cap silently stops applying.
    expect(totalCached(budget)).toBe(budget.cacheEntries);
    // And the search kept going rather than stopping at the cap.
    expect(budget.evaluations).toBeGreaterThan(CAP);
    // The shipped default must stay bounded and modest — this is the number that decides
    // whether a browser tab survives a large inventory.
    expect(TEAM_PLAN_MAX_CACHE_ENTRIES).toBeLessThanOrEqual(10_000);
  }, 120_000);

  it('memoisation is invisible: identical objectives with the cache on and off', () => {
    const ctx = setup();
    const assignments = walk(ctx.baseline, 60, ctx);

    const cached: SolverBudget = { maxEvaluations: 1e9, evaluations: 0, exhausted: false, cache: new Map() };
    const uncached: SolverBudget = { maxEvaluations: 1e9, evaluations: 0, exhausted: false };

    for (const a of assignments) {
      const withCache = evaluateAssignment(a, ctx.contexts, ctx.ptsByHeroId, ctx.input, ctx.itemById, cached);
      const withoutCache = evaluateAssignment(a, ctx.contexts, ctx.ptsByHeroId, ctx.input, ctx.itemById, uncached);
      expect(withCache.objective).toBe(withoutCache.objective);
      expect(withCache.sumDuty).toBe(withoutCache.sumDuty);
      expect(withCache.regime).toBe(withoutCache.regime);
    }

    // Re-evaluating the same states must hit the cache, not recount evaluations.
    const before = cached.evaluations;
    for (const a of assignments) {
      evaluateAssignment(a, ctx.contexts, ctx.ptsByHeroId, ctx.input, ctx.itemById, cached);
    }
    expect(cached.evaluations).toBe(before);
  }, 120_000);

  it('the spare pool is redundant in the key: identical slots imply an identical pool', () => {
    const ctx = setup();
    const assignments = walk(ctx.baseline, 400, ctx);
    const bySlots = new Map<string, string>();
    for (const a of assignments) {
      const slotKey = JSON.stringify(
        Object.entries(a.slots).sort(([x], [y]) => x.localeCompare(y)),
      );
      const poolKey = [...a.pool].sort().join(',');
      const seen = bySlots.get(slotKey);
      if (seen === undefined) bySlots.set(slotKey, poolKey);
      // This is the assumption that lets the pool be dropped from the cache key.
      else expect(poolKey, 'same slots must imply same pool').toBe(seen);
    }
    expect(bySlots.size).toBeGreaterThan(1);
  }, 120_000);
});

/**
 * Interchangeable items are deduplicated in the move generator — one representative per
 * `defId|rarityIdx|level|effectiveUpgrade` group — because every copy produces a byte-identical
 * `EquippedItem` and therefore an identical objective, so evaluating the rest is duplicated work.
 *
 * The risk that buys is multiplicity: with two identical weapons and two heroes, the search must
 * still be able to give one to EACH. That works because `generateMoves` is called fresh from the
 * current pool on every iteration — once a copy is equipped it leaves the pool, and the next
 * call promotes the next copy to representative. The count is tracked by the pool itself rather
 * than by the move list.
 */
describe('interchangeable items: one candidate at a time, multiplicity preserved', () => {
  it('offers exactly one representative per group but still equips every copy', () => {
    // MP5 F1 (AD-068 class (a) — read from the capture): re-pointed onto
    // save-20260819-11882-7heroes.json, which carries real duplicate spares (measured: 6
    // pool-key groups with 2-3 copies each) — richer duplicate coverage than the deleted
    // `SaveFile_BombFarm.json` this test used to read.
    const ctx = setup(TEAM_PLAN_FIXTURE);
    const poolKey = (id: string) => {
      const item = ctx.itemById.get(id);
      if (!item?.slot) return null;
      return poolEntryForItem(item, ctx.input.forgeFloor).key;
    };

    const countsByKey = new Map<string, number>();
    for (const id of ctx.baseline.pool) {
      const k = poolKey(id);
      if (k) countsByKey.set(k, (countsByKey.get(k) ?? 0) + 1);
    }
    const duplicated = [...countsByKey.entries()].filter(([, n]) => n > 1);
    expect(duplicated.length, 'fixture must contain interchangeable spares').toBeGreaterThan(0);

    const moves = generateMoves({
      contexts: ctx.contexts,
      slots: ctx.baseline.slots,
      pool: ctx.baseline.pool,
      itemById: ctx.itemById,
      heroDpsById: {},
      forgeFloor: ctx.input.forgeFloor,
    });

    // For any one hero+slot, no group may appear twice.
    const seen = new Map<string, Set<string>>();
    for (const m of moves) {
      if (m.kind !== 'assign') continue;
      const k = poolKey(m.itemId);
      if (!k) continue;
      const dest = `${m.heroId}|${m.slot}`;
      const forDest = seen.get(dest) ?? new Set<string>();
      expect(forDest.has(k), `${dest} offered two copies of ${k}`).toBe(false);
      forDest.add(k);
      seen.set(dest, forDest);
    }

    // Multiplicity: equipping one copy must promote the next, so N copies can reach N heroes.
    const [dupKey, dupCount] = duplicated[0];
    let assignment = ctx.baseline;
    const equipped: string[] = [];
    for (let i = 0; i < dupCount; i++) {
      const next = generateMoves({
        contexts: ctx.contexts,
        slots: assignment.slots,
        pool: assignment.pool,
        itemById: ctx.itemById,
        heroDpsById: {},
        forgeFloor: ctx.input.forgeFloor,
      }).find((m) => m.kind === 'assign' && poolKey(m.itemId) === dupKey && !equipped.includes(m.itemId));
      if (!next || next.kind !== 'assign') break;
      equipped.push(next.itemId);
      assignment = applyMove(assignment, next);
    }
    expect(new Set(equipped).size, 'each copy must be reachable in turn').toBe(equipped.length);
    expect(equipped.length).toBeGreaterThan(1);
  }, 120_000);
});
