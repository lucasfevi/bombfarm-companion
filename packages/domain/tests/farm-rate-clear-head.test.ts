/**
 * The head of a clear — the seconds a wave spends before and while the squad comes up to speed.
 *
 * `clearHeadSeconds` is the measured wave shape the per-hero DPS surfaces still read (activation
 * stagger of 0.5 s per hero, then one fuse). The row itself prices the head inside the
 * standing-props integral (`model/clear-time.ts`): nothing dies before `FIRST_KILL_SEC`, and the
 * first kills come at a reduced rate while heroes cross the map. The row claims below are the
 * ones that survive either form: the head is paid once per wave, not per hero, and it costs a fast
 * clear a bigger share of its throughput than a slow one.
 */
import { describe, expect, it } from 'vitest';
import {
  computeSquadFarmFacts,
  computeFarmRateRow,
  clearHeadSeconds,
  HERO_ACTIVATION_STAGGER_SEC,
  type HeroFarmFacts,
} from '@bombfarm/domain/farm-rate';
import { FIRST_KILL_SEC } from '@bombfarm/domain/model/clear-time';
import { propCountForAto } from '@bombfarm/domain/phase-wiki';
import { FUSE_FLOOR, STAT_CAPS } from '@bombfarm/domain/model';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { account } = loadFarmRateFixture();
const UNCONSTRAINED = { ...account, slots: 1000, fieldSlots: 1000 };

function syntheticHero(overrides: Partial<HeroFarmFacts> & { heroId: string }): HeroFarmFacts {
  return {
    heroName: overrides.heroId,
    avgHitBase: 1e12, // one-shots everything, so throughput is cadence alone
    penetrationPct: 0,
    fuseSecs: 2,
    fuseFloorSecs: FUSE_FLOOR,
    cdrCapPct: STAT_CAPS.cdr,
    walkSpeedCells: 2,
    cycleSecs: 2,
    plantsPerSec: 0.5,
    blocksPerBomb: 1,
    uptime: 1,
    heroLuckPct: 0,
    veiaOuroLevel: 0,
    fortunaLevel: 0,
    degenerate: false,
    ...overrides,
  };
}

function rowFor(heroes: readonly HeroFarmFacts[], phase: number) {
  return computeFarmRateRow(phase, computeSquadFarmFacts(heroes, UNCONSTRAINED))!;
}

const NON_GATE_ATO_1 = 42;
const NON_GATE_ATO_2 = 51;

describe('the fuse burns before the first kill', () => {
  it('a longer fuse lengthens the clear and lowers every hourly rate', () => {
    const quick = rowFor([syntheticHero({ heroId: 'a', fuseSecs: 1 })], NON_GATE_ATO_1);
    const slow = rowFor([syntheticHero({ heroId: 'a', fuseSecs: 3 })], NON_GATE_ATO_1);
    expect(slow.clearSecs).toBeGreaterThan(quick.clearSecs);
    expect(slow.propsPerHour).toBeLessThan(quick.propsPerHour);
    expect(slow.goldPerHour).toBeLessThan(quick.goldPerHour);
  });

  it('nothing dies before the first fuse has burnt, whatever the squad', () => {
    for (const count of [1, 4, 9]) {
      const squad = Array.from({ length: count }, (_, i) => syntheticHero({ heroId: `h${i}` }));
      expect(rowFor(squad, NON_GATE_ATO_1).clearSecs).toBeGreaterThan(FIRST_KILL_SEC);
    }
  });

  it('the squad pays ONE fuse, not one per hero — it is a pipeline fill, not a per-hero cost', () => {
    const four = [0, 1, 2, 3].map((i) => syntheticHero({ heroId: `h${i}`, fuseSecs: 2 }));
    const head = clearHeadSeconds(4, 2);
    expect(head).toBe((HERO_ACTIVATION_STAGGER_SEC * 3) / 2 + 2);
    expect(rowFor(four, NON_GATE_ATO_1).clearSecs).toBeGreaterThan(head);
    expect(head).toBeLessThan(4 * 2);
  });
});

describe('heroes come up one at a time', () => {
  it('each hero past the first costs half a stagger in the measured wave shape', () => {
    for (const count of [1, 2, 3, 5, 9]) {
      expect(clearHeadSeconds(count, 2)).toBeCloseTo((HERO_ACTIVATION_STAGGER_SEC * (count - 1)) / 2 + 2, 12);
    }
  });

  it('the last hero of a 9-strong field roster is moving at 4.0s — the measured wave shape', () => {
    expect(HERO_ACTIVATION_STAGGER_SEC * (9 - 1)).toBe(4);
    expect(clearHeadSeconds(9, 0) * 9).toBeCloseTo(18, 12);
  });

  it('a mean occupancy below one hero owes no stagger at all, and never negative seconds', () => {
    expect(clearHeadSeconds(0.4, 1.9)).toBe(1.9);
    expect(clearHeadSeconds(0, 1.9)).toBe(1.9);
    expect(clearHeadSeconds(1, 1.9)).toBe(1.9);
  });

  it('more heroes clear faster, but never as many times faster as there are heroes', () => {
    const one = rowFor([syntheticHero({ heroId: 'h0' })], NON_GATE_ATO_1).clearSecs;
    const four = rowFor(
      Array.from({ length: 4 }, (_, i) => syntheticHero({ heroId: `h${i}` })),
      NON_GATE_ATO_1,
    ).clearSecs;
    expect(four).toBeLessThan(one);
    expect(one / four).toBeLessThan(4);
  });
});

describe('what the head does to the board', () => {
  const squad = [0, 1, 2, 3].map((i) => syntheticHero({ heroId: `h${i}` }));

  it('is a fixed cost per clear: a map half again as long takes less than half again as long', () => {
    const short = rowFor(squad, NON_GATE_ATO_1);
    const long = rowFor(squad, NON_GATE_ATO_2);
    expect(long.ato).toBeGreaterThan(short.ato);
    const propRatio = propCountForAto(long.ato) / propCountForAto(short.ato);
    expect(propRatio).toBeGreaterThan(1);
    expect(long.clearSecs / short.clearSecs).toBeLessThan(propRatio);
    expect(long.clearSecs / short.clearSecs).toBeGreaterThan(1);
  });

  it('so it costs a FAST clear a bigger share of its throughput than a slow one', () => {
    const fast = rowFor(squad, NON_GATE_ATO_1);
    const slower = rowFor(
      squad.map((hero) => ({ ...hero, walkSpeedCells: hero.walkSpeedCells / 4, fuseSecs: hero.fuseSecs * 4 })),
      NON_GATE_ATO_1,
    );
    expect(slower.clearSecs).toBeGreaterThan(fast.clearSecs);
    expect(FIRST_KILL_SEC / fast.clearSecs).toBeGreaterThan(FIRST_KILL_SEC / slower.clearSecs);
  });
});
