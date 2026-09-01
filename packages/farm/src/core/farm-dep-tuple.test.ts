import { describe, expect, it } from 'vitest';
import { createFarmRankingMemo } from './farm-memo';
import { readFarmDepTuple, readFarmRespecDepTuple } from './farm-compute';
import type { FarmInputs } from './farm-inputs';

/**
 * The dependency tuple is the whole recompute contract, and its failure mode is silent: a field
 * left out of it is a planner edit that does not recompute the board, with no error anywhere and
 * a stale table that still looks like a real answer. Nothing else in this package catches that,
 * so the table below names all 19 members by the POSITION they occupy and proves, per member,
 * that it is the only position a change to it moves — and that a change to it forces a fresh
 * compute while an equal-valued input object does not.
 */

/**
 * The three members the tuple compares by REFERENCE. Hoisted so `baseInputs()` hands back the
 * same three objects every call — which is exactly the contract a host's producers owe, and
 * without which the "an equal-valued fresh input record does not recompute" control below would
 * be impossible to state.
 */
const HEROES: FarmInputs['heroes'] = [];
const TEAM_BUFFS: FarmInputs['effectiveTeamBuffs'] = {};
const POOL_OVERRIDES: FarmInputs['farmPoolOverrides'] = {};

function baseInputs(): FarmInputs {
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

type TupleMember = {
  index: number;
  name: string;
  /** Returns a fresh inputs record differing from `inputs` in exactly this one field. */
  change: (inputs: FarmInputs) => FarmInputs;
};

const TUPLE_MEMBERS: readonly TupleMember[] = [
  // A reference compare, not a value one: an empty roster rebuilt is still a change. This is the
  // member every roster producer's return-the-same-array contract exists to protect.
  { index: 0, name: 'heroes', change: (i) => ({ ...i, heroes: [...i.heroes] }) },
  { index: 1, name: 'treeDanoTotal', change: (i) => ({ ...i, treeDanoTotal: 2 }) },
  { index: 2, name: 'treeCritChance', change: (i) => ({ ...i, treeCritChance: 5 }) },
  { index: 3, name: 'treeCritDmg', change: (i) => ({ ...i, treeCritDmg: 5 }) },
  { index: 4, name: 'treeSpeed', change: (i) => ({ ...i, treeSpeed: 5 }) },
  { index: 5, name: 'treeEnergy', change: (i) => ({ ...i, treeEnergy: 5 }) },
  { index: 6, name: 'treeTeamCoinPct', change: (i) => ({ ...i, treeTeamCoinPct: 5 }) },
  { index: 7, name: 'treeLuckFlatPct', change: (i) => ({ ...i, treeLuckFlatPct: 5 }) },
  // Also a reference compare, and the member that carries BOTH halves of the team-buff input:
  // the roster-derived total and the hand-typed override resolve into this one field.
  {
    index: 8,
    name: 'effectiveTeamBuffs',
    change: (i) => ({ ...i, effectiveTeamBuffs: { grito_guerra: 3 } }),
  },
  { index: 9, name: 'houseIdx', change: (i) => ({ ...i, houseIdx: 2 }) },
  { index: 10, name: 'houseLevel', change: (i) => ({ ...i, houseLevel: 4 }) },
  { index: 11, name: 'slots', change: (i) => ({ ...i, slots: 5 }) },
  { index: 12, name: 'fieldSlots', change: (i) => ({ ...i, fieldSlots: 6 }) },
  { index: 13, name: 'houseCycleSecs', change: (i) => ({ ...i, houseCycleSecs: 120 }) },
  {
    index: 14,
    name: 'houseCycleSecsHouseIdx',
    change: (i) => ({ ...i, houseCycleSecsHouseIdx: 1 }),
  },
  { index: 15, name: 'houseCycleSecsLevel', change: (i) => ({ ...i, houseCycleSecsLevel: 2 }) },
  { index: 16, name: 'maxPhase', change: (i) => ({ ...i, maxPhase: 42 }) },
  {
    index: 17,
    name: 'farmPoolOverrides',
    change: (i) => ({ ...i, farmPoolOverrides: { a: false } }),
  },
  { index: 18, name: 'farmReturnBonus', change: (i) => ({ ...i, farmReturnBonus: 'vip' }) },
];

describe('readFarmDepTuple', () => {
  it('has exactly 19 members, one per named member of the table below', () => {
    expect(readFarmDepTuple(baseInputs())).toHaveLength(19);
    expect(TUPLE_MEMBERS).toHaveLength(19);
    expect(TUPLE_MEMBERS.map((member) => member.index)).toEqual(
      TUPLE_MEMBERS.map((_, position) => position),
    );
  });

  it('the respec tuple is the ranking tuple, member for member', () => {
    const inputs = baseInputs();
    expect(readFarmRespecDepTuple(inputs)).toEqual(readFarmDepTuple(inputs));
  });

  describe('each member occupies its own position and no other', () => {
    for (const member of TUPLE_MEMBERS) {
      it(`${member.name} moves only position ${member.index}`, () => {
        const before = readFarmDepTuple(baseInputs());
        const after = readFarmDepTuple(member.change(baseInputs()));
        expect(
          Object.is(before[member.index], after[member.index]),
          `${member.name} did not move position ${member.index}`,
        ).toBe(false);
        for (let position = 0; position < before.length; position++) {
          if (position === member.index) continue;
          expect(
            Object.is(before[position], after[position]),
            `${member.name} also moved position ${position}`,
          ).toBe(true);
        }
      });
    }
  });
});

describe('each dep-tuple member invalidates the memo, and nothing else does', () => {
  for (const member of TUPLE_MEMBERS) {
    it(`${member.name} forces a recompute; an equal-valued fresh input record does not`, () => {
      const memo = createFarmRankingMemo();
      const inputs = baseInputs();

      memo.rows(inputs);
      expect(memo.rowsComputeCount()).toBe(1);

      // The control. Hosts rebuild this record on every call, so a memo that keyed on the
      // record's identity would recompute forever — and the per-member half below would pass
      // for the wrong reason.
      memo.rows(baseInputs());
      expect(memo.rowsComputeCount()).toBe(1);

      memo.rows(member.change(inputs));
      expect(memo.rowsComputeCount()).toBe(2);
    });
  }

  it('the Tier 1 gate is memoized over the same tuple', () => {
    const memo = createFarmRankingMemo();
    memo.gate(baseInputs());
    memo.gate(baseInputs());
    expect(memo.gateComputeCount()).toBe(1);
    memo.gate({ ...baseInputs(), maxPhase: 42 });
    expect(memo.gateComputeCount()).toBe(2);
  });
});
