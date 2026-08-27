/**
 * The field-contention diagnostic must not cost a fixed point per row.
 *
 * `fieldContentionFraction` solves for its own demand, which is `O(rounds × heroes²)`. Its inputs
 * are the House-ALLOCATED duty cycles, so on a roster whose House is slack they are identical on
 * every one of the 600 rows and the answer is the same every time. Computing it per row anyway put
 * the respec optimizer 4x slower on a 13-hero capture — 5.7s to 23.5s over an unchanged 7,352
 * evaluations — which timed the Farm Respec panel out in e2e.
 *
 * Counted rather than timed, deliberately: a wall-clock bound is flaky on shared CI, and the
 * defect is algorithmic, so the count is the honest invariant. This file owns the counter
 * exclusively — it is module-global mutable state, so a parallel file building a farm table would
 * corrupt it.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  computeFarmRateTable,
  computeHeroFarmFacts,
  computeSquadFarmFacts,
  fieldContentionSolveCount,
  resetFieldContentionSolveCount,
} from '@bombfarm/domain/farm-rate';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

/** 13 heroes against 9 field slots, House slack — the shape that exposed the regression. */
const CONTENDED_FIXTURE = 'save-20260823-13heroes-crit-points.json';

beforeEach(() => {
  resetFieldContentionSolveCount();
});

function squadFor(filename: string) {
  const { heroes, account } = loadFarmRateFixture(filename);
  const facts = computeHeroFarmFacts({ heroes, account });
  return computeSquadFarmFacts(facts, account);
}

describe('the contention fixed point runs per distinct allocation, not per row', () => {
  it('a full 600-row table on a slack-House roster solves it ONCE', () => {
    const squad = squadFor(CONTENDED_FIXTURE);
    expect(squad.houseSlotDemand).toBeLessThanOrEqual(squad.houseSlots);
    expect(squad.heroes.length).toBeGreaterThan(squad.fieldSlots);

    const rows = computeFarmRateTable(squad);
    expect(rows).toHaveLength(600);
    expect(fieldContentionSolveCount).toBe(1);
  });

  it('the memo returns the same value it would have computed, on every row', () => {
    const squad = squadFor(CONTENDED_FIXTURE);
    const rows = computeFarmRateTable(squad);
    const distinct = new Set(rows.map((row) => row.fieldContentionPct));
    expect(distinct.size).toBe(1);
    // and it is a real figure, not a degenerate zero the memo could be hiding
    expect([...distinct][0]).toBeGreaterThan(0);
  });

  it('a second table for the SAME squad adds no further solves', () => {
    const squad = squadFor(CONTENDED_FIXTURE);
    computeFarmRateTable(squad);
    const afterFirst = fieldContentionSolveCount;
    computeFarmRateTable(squad);
    expect(fieldContentionSolveCount).toBe(afterFirst);
  });

  it('a roster that cannot fill the field never solves at all', () => {
    const squad = squadFor(CONTENDED_FIXTURE);
    const roomy = { ...squad, fieldSlots: squad.heroes.length + 1 };
    const rows = computeFarmRateTable(roomy);
    expect(fieldContentionSolveCount).toBe(0);
    expect(rows.every((row) => row.fieldContentionPct === 0)).toBe(true);
  });
});
