import { describe, expect, it } from 'vitest';
import { COMPACT_FIELD } from '@bombfarm/domain/model';
import { buildAccount, readFarmDepTuple } from './farm-compute';
import type { FarmInputs } from './farm-inputs';

const inputs = (overrides: Partial<FarmInputs> = {}): FarmInputs => ({
  heroes: [],
  treeDanoTotal: 0,
  treeCritChance: 0,
  treeCritDmg: 0,
  treeSpeed: 0,
  treeEnergy: 0,
  treeTeamCoinPct: 0,
  treeLuckFlatPct: 0,
  treeXpMult: null,
  houseIdx: 0,
  houseLevel: 1,
  slots: undefined,
  fieldSlots: null,
  houseCycleSecs: null,
  houseCycleSecsHouseIdx: null,
  houseCycleSecsLevel: null,
  maxPhase: null,
  farmPoolOverrides: {},
  farmReturnBonus: 'off',
  aurasAtCap: [],
  ...overrides,
});

describe('the map the farm board prices', () => {
  it('puts the compact field on the account it prices against', () => {
    expect(buildAccount(inputs({ farmMapSize: 'compact' })).field).toEqual(COMPACT_FIELD);
  });

  it('leaves the classic account exactly as it was before the map could be picked', () => {
    expect(buildAccount(inputs({ farmMapSize: 'classic' }))).toEqual(buildAccount(inputs()));
    expect('field' in buildAccount(inputs())).toBe(false);
  });

  it('reads an absent map and the classic one as the same board', () => {
    expect(readFarmDepTuple(inputs())).toEqual(readFarmDepTuple(inputs({ farmMapSize: 'classic' })));
  });
});
