/**
 * The head of a clear — the seconds between the wave starting and the first prop falling.
 *
 * A clear does not begin at full throughput. Heroes activate one at a time down the field roster,
 * and the first bomb planted still has to burn its fuse before anything explodes. Neither cost is
 * inside the steady-state cycle: that cycle's latency terms are per-BOMB, and the fuse reaches it
 * only overlapped with the walk to the next plant.
 *
 * Every case here is written so it FAILS IF THE HEAD IS DROPPED, and none of them pins a modelled
 * figure a second time. They isolate the term instead — synthetic `HeroFarmFacts` carry
 * `fuseSecs` and `plantsPerSec` as independent fields, so a fuse that reaches `clearSecs` at a
 * fixed plant rate can only have reached it through the head.
 */
import { describe, expect, it } from 'vitest';
import {
  computeSquadFarmFacts,
  computeFarmRateRow,
  clearHeadSeconds,
  HERO_ACTIVATION_STAGGER_SEC,
  type HeroFarmFacts,
} from '@bombfarm/domain/farm-rate';
import { propCountForAto, wikiPhaseLine } from '@bombfarm/domain/phase-wiki';
import { EFF_IA, FUSE_FLOOR, STAT_CAPS } from '@bombfarm/domain/model';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { account } = loadFarmRateFixture();

/** Both ceilings lifted: every hero at uptime 1 asks the House for nothing and the field is wide,
 *  so `heroesOnField` is exactly the roster size and only the head can move a clear. */
const UNCONSTRAINED = { ...account, slots: 1000, fieldSlots: 1000 };

function syntheticHero(overrides: Partial<HeroFarmFacts> & { heroId: string }): HeroFarmFacts {
  return {
    heroName: overrides.heroId,
    avgHitBase: 1e12, // one-shots everything, so eHtk is 1 and throughput is the plant rate
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
  it('a longer fuse lengthens the clear at an unchanged plant rate — which nothing but the head can do', () => {
    const quick = rowFor([syntheticHero({ heroId: 'a', fuseSecs: 1 })], NON_GATE_ATO_1);
    const slow = rowFor([syntheticHero({ heroId: 'a', fuseSecs: 3 })], NON_GATE_ATO_1);

    // `plantsPerSec` is identical on both, so the props themselves take identical seconds.
    expect(slow.clearSecs - quick.clearSecs).toBeCloseTo(2, 12);
    expect(slow.propsPerHour).toBeLessThan(quick.propsPerHour);
    expect(slow.goldPerHour).toBeLessThan(quick.goldPerHour);
  });

  it('one hero owes the fuse and nothing else — there is nobody to activate behind', () => {
    const hero = syntheticHero({ heroId: 'solo', fuseSecs: 1.7 });
    const row = rowFor([hero], NON_GATE_ATO_1);
    const propsOnlySecs = propCountForAto(row.ato) / (hero.plantsPerSec * hero.blocksPerBomb * EFF_IA);

    expect(row.heroesOnField).toBe(1);
    expect(row.clearSecs - propsOnlySecs).toBeCloseTo(hero.fuseSecs, 6);
  });

  it('the squad pays ONE fuse, not one per hero — it is a pipeline fill, not a per-hero cost', () => {
    const four = [0, 1, 2, 3].map((i) => syntheticHero({ heroId: `h${i}`, fuseSecs: 2 }));
    const head = clearHeadSeconds(4, 2);
    expect(head).toBe((HERO_ACTIVATION_STAGGER_SEC * 3) / 2 + 2);
    expect(rowFor(four, NON_GATE_ATO_1).clearSecs).toBeGreaterThan(head);
    // Four fuses would be 8s of head; the model charges 2s of fuse plus 0.75s of stagger.
    expect(head).toBeLessThan(4 * 2);
  });
});

describe('heroes come up one at a time', () => {
  const withFieldRoster = (count: number) =>
    rowFor(
      Array.from({ length: count }, (_, i) => syntheticHero({ heroId: `h${i}` })),
      NON_GATE_ATO_1,
    );

  it('each hero past the first costs half a stagger, and the props are unaffected', () => {
    for (const count of [1, 2, 3, 5, 9]) {
      const row = withFieldRoster(count);
      expect(row.heroesOnField).toBe(count);
      const propsOnlySecs = propCountForAto(row.ato) / (count * 0.5 * EFF_IA);
      expect(row.clearSecs - propsOnlySecs).toBeCloseTo(
        (HERO_ACTIVATION_STAGGER_SEC * (count - 1)) / 2 + 2,
        6,
      );
    }
  });

  it('the last hero of a 9-strong field roster is moving at 4.0s — the measured wave shape', () => {
    // What the term is built on: activations 0.500s apart down the roster, so hero 9 starts at
    // 4.0s and the squad has lost 0.25 x 9 x 8 = 18 hero-seconds by then.
    expect(HERO_ACTIVATION_STAGGER_SEC * (9 - 1)).toBe(4);
    expect(clearHeadSeconds(9, 0) * 9).toBeCloseTo(18, 12);
  });

  it('a mean occupancy below one hero owes no stagger at all, and never negative seconds', () => {
    expect(clearHeadSeconds(0.4, 1.9)).toBe(1.9);
    expect(clearHeadSeconds(0, 1.9)).toBe(1.9);
    expect(clearHeadSeconds(1, 1.9)).toBe(1.9);
  });
});

describe('what the head does to the board', () => {
  const squad = [0, 1, 2, 3].map((i) => syntheticHero({ heroId: `h${i}` }));

  it('is a fixed cost per clear: the same squad pays the same head on a longer map', () => {
    const short = rowFor(squad, NON_GATE_ATO_1);
    const long = rowFor(squad, NON_GATE_ATO_2);
    expect(long.ato).toBeGreaterThan(short.ato);
    expect(propCountForAto(long.ato)).toBeGreaterThan(propCountForAto(short.ato));

    const rate = 4 * 0.5 * EFF_IA;
    const headOf = (row: typeof short) => row.clearSecs - propCountForAto(row.ato) / rate;
    expect(headOf(long)).toBeCloseTo(headOf(short), 6);
  });

  it('so it costs a FAST clear a bigger share of its throughput than a slow one', () => {
    // The consequence for a farm board: charging the head pushes recommendations toward higher
    // phases, because the phases it hurts most are the quick ones a strong squad blows through.
    const fastPhase = wikiPhaseLine(NON_GATE_ATO_1)!;
    const rate = 4 * 0.5 * EFF_IA;
    const fast = rowFor(squad, fastPhase.phase);
    const slower = rowFor(
      squad.map((hero) => ({ ...hero, plantsPerSec: hero.plantsPerSec / 4 })),
      fastPhase.phase,
    );

    const headShare = (row: typeof fast, propRate: number) =>
      (row.clearSecs - propCountForAto(row.ato) / propRate) / row.clearSecs;
    expect(headShare(fast, rate)).toBeGreaterThan(headShare(slower, rate / 4));
  });
});
