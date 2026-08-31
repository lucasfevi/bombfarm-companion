import { describe, expect, it } from 'vitest';
import { createFarmRankingMemo } from './farm-memo';
import type { FarmInputs } from './farm-inputs';

/**
 * Two host apps now run this compute, and a memo they shared would let one app's warm cache
 * answer the other's call — and one app's test reset silently clear the other's counters. Every
 * assertion here is about that separation, so it is written as "computing on A leaves B cold",
 * never as "A and B report different numbers", which a single shared instance could also satisfy.
 */

/** Hoisted: the tuple compares these three by reference, so a cache hit is only possible when
 *  every `inputs()` call hands back the same three objects. */
const HEROES: FarmInputs['heroes'] = [];
const TEAM_BUFFS: FarmInputs['effectiveTeamBuffs'] = {};
const POOL_OVERRIDES: FarmInputs['farmPoolOverrides'] = {};

function inputs(): FarmInputs {
  return {
    heroes: HEROES,
    treeDanoTotal: 1,
    treeCritChance: 0,
    treeCritDmg: 0,
    treeSpeed: 0,
    treeEnergy: 0,
    treeTeamCoinPct: 0,
    treeLuckFlatPct: 0,
    effectiveTeamBuffs: TEAM_BUFFS,
    teamBuffsOverride: null,
    houseIdx: 0,
    houseLevel: 0,
    slots: 9,
    fieldSlots: null,
    houseCycleSecs: null,
    houseCycleSecsHouseIdx: null,
    houseCycleSecsLevel: null,
    maxPhase: null,
    farmPoolOverrides: POOL_OVERRIDES,
    farmReturnBonus: 'off',
  };
}

describe('createFarmRankingMemo instances are isolated', () => {
  it('a warm rows cache on one instance does not satisfy another', () => {
    const first = createFarmRankingMemo();
    const second = createFarmRankingMemo();

    const fromFirst = first.rows(inputs());
    expect(first.rowsComputeCount()).toBe(1);
    expect(second.rowsComputeCount()).toBe(0);

    const fromSecond = second.rows(inputs());
    expect(second.rowsComputeCount()).toBe(1);
    expect(fromSecond).not.toBe(fromFirst);
  });

  it('a warm gate cache on one instance does not satisfy another', () => {
    const first = createFarmRankingMemo();
    const second = createFarmRankingMemo();

    first.gate(inputs());
    first.gate(inputs());
    expect(first.gateComputeCount()).toBe(1);
    expect(second.gateComputeCount()).toBe(0);

    second.gate(inputs());
    expect(second.gateComputeCount()).toBe(1);
  });

  it('the solve counter is per instance', () => {
    const first = createFarmRankingMemo();
    const second = createFarmRankingMemo();

    first.solve(inputs());
    first.solve(inputs());
    expect(first.solveCount()).toBe(2);
    expect(second.solveCount()).toBe(0);
  });

  it('resetting one instance leaves the other warm and its counters intact', () => {
    const first = createFarmRankingMemo();
    const second = createFarmRankingMemo();

    first.rows(inputs());
    second.rows(inputs());

    first.resetRowsComputeCount();
    expect(first.rowsComputeCount()).toBe(0);
    expect(second.rowsComputeCount()).toBe(1);

    // The reset dropped the first instance's cache, not the second's: recomputing on `first`
    // costs a compute, while `second` still answers from its own entry.
    first.rows(inputs());
    second.rows(inputs());
    expect(first.rowsComputeCount()).toBe(1);
    expect(second.rowsComputeCount()).toBe(1);
  });
});
