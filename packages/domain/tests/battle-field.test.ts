import { describe, expect, it } from 'vitest';
import { computeFarmRateRow, computeHeroFarmBases, squadFactsFromBases } from '@bombfarm/domain/farm-rate';
import { cycleSecondsForHero } from '../src/model/cadence';
import {
  CLASSIC_FIELD,
  COMPACT_FIELD,
  classicDistanceOn,
  classicEquivalentStanding,
  fieldCells,
  meanCellDistance,
  simulateClear,
  type ClearHero,
  type ClearPropType,
} from '../src/model/clear-time';
import { WIKI_PROPS } from '../src/phase-wiki';
import { loadTeamPlanFarmFixture } from './helpers/team-plan-farm-fixtures';

const MIX: ClearPropType[] = WIKI_PROPS.map((prop) => ({ hp: 1_000_000 * prop.hpMult, weight: prop.weight }));

function squad(overrides: Partial<ClearHero> = {}): ClearHero[] {
  return Array.from({ length: 9 }, () => ({
    presence: 0.9,
    fuseSecs: 1.7,
    walkSpeedCells: 3.2,
    blastCells: 13,
    hitNoCrit: 300_000,
    critChance: 0.4,
    critMult: 7,
    ...overrides,
  }));
}

const CAP_FUSE = 0.4;
const cdrCapGain = (walk: number, field = CLASSIC_FIELD) =>
  cycleSecondsForHero(1.7, walk, 3, field) / cycleSecondsForHero(CAP_FUSE, walk, 3, field);

describe('the battlefield grid', () => {
  it('the classic field is 19 × 16 and the compact one 19 × 11', () => {
    expect(fieldCells(CLASSIC_FIELD)).toBe(304);
    expect(fieldCells(COMPACT_FIELD)).toBe(209);
  });

  it('two random cells sit ~11.6 cells apart on the classic field and ~9.95 on the compact one', () => {
    expect(meanCellDistance(CLASSIC_FIELD)).toBeCloseTo(11.63, 2);
    expect(meanCellDistance(COMPACT_FIELD)).toBeCloseTo(9.95, 2);
  });

  it('the same props on fewer cells stand as densely as more props on the classic field', () => {
    expect(classicEquivalentStanding(100, COMPACT_FIELD)).toBeCloseTo(145.45, 2);
  });

  it('leaves classic-field inputs bit-identical, so the pinned optimizer goldens cannot move', () => {
    expect(classicEquivalentStanding(0.1 + 0.2, CLASSIC_FIELD)).toBe(0.1 + 0.2);
    expect(classicDistanceOn(10, CLASSIC_FIELD)).toBe(10);
    expect(simulateClear(squad(), MIX, 100, CLASSIC_FIELD)).toEqual(simulateClear(squad(), MIX, 100));
    expect(cycleSecondsForHero(1.7, 3.2, 3, CLASSIC_FIELD)).toBe(cycleSecondsForHero(1.7, 3.2, 3));
  });
});

describe('clearing the same props on the compact field', () => {
  it('is faster, because every hop is shorter', () => {
    const classic = simulateClear(squad(), MIX, 100);
    const compact = simulateClear(squad(), MIX, 100, COMPACT_FIELD);
    expect(compact.clearSecs).toBeLessThan(classic.clearSecs);
    expect(compact.plantRateByHero[0]).toBeGreaterThan(classic.plantRateByHero[0]);
  });

  it('makes the cooldown cap worth more, since walking binds fewer cycles', () => {
    expect(cdrCapGain(3.2, COMPACT_FIELD)).toBeGreaterThan(cdrCapGain(3.2));
  });

  it('makes walk speed worth less for the same reason', () => {
    const speedGain = (field = CLASSIC_FIELD) =>
      cycleSecondsForHero(1.7, 3.2, 3, field) / cycleSecondsForHero(1.7, 4.2, 3, field);
    expect(speedGain(COMPACT_FIELD)).toBeLessThan(speedGain());
  });

  it('caches each field apart, so pricing one never answers for the other', () => {
    const classic = cycleSecondsForHero(1.3, 2.9, 3);
    const compact = cycleSecondsForHero(1.3, 2.9, 3, COMPACT_FIELD);
    expect(compact).toBeLessThan(classic);
    expect(cycleSecondsForHero(1.3, 2.9, 3)).toBe(classic);
  });
});

describe('the farm board on the compact field', () => {
  it('prices the same squad at more gold per hour', () => {
    const fixture = loadTeamPlanFarmFixture('save-20260831-13heroes-soulbound.json');
    const bases = computeHeroFarmBases({
      heroes: fixture.heroes,
      account: fixture.account,
      enabledHeroIds: fixture.enabledHeroIds,
    });
    const facts = squadFactsFromBases(bases, null, fixture.account);
    const classic = computeFarmRateRow(151, facts);
    const compact = computeFarmRateRow(151, facts, { field: COMPACT_FIELD });
    expect(classic).not.toBeNull();
    expect(compact!.goldPerHour).toBeGreaterThan(classic!.goldPerHour);
  });
});
