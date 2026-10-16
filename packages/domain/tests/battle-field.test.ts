import { describe, expect, it } from 'vitest';
import { computeFarmRateRow, computeFarmRates, computeHeroFarmBases, squadFactsFromBases } from '@bombfarm/domain/farm-rate';
import { cycleSecondsForHero } from '../src/model/cadence';
import {
  battleFieldFor,
  isMapSize,
  mapSizeOfCells,
  CLASSIC_FIELD,
  COMPACT_FIELD,
  classicDistanceOn,
  classicEquivalentStanding,
  fieldCells,
  fieldWalkSpeedCells,
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
  it('names each field by the map a player picks, and reads it off a frame by its cell count', () => {
    expect(battleFieldFor('classic')).toBe(CLASSIC_FIELD);
    expect(battleFieldFor('compact')).toBe(COMPACT_FIELD);
    expect(mapSizeOfCells(304)).toBe('classic');
    expect(mapSizeOfCells(209)).toBe('compact');
    expect(mapSizeOfCells(0)).toBeNull();
    expect(isMapSize('compact')).toBe(true);
    expect(isMapSize('small')).toBe(false);
  });

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
  it('moves every hero at the ratio of mean cell distances, ~0.856 of its classic speed (measured 0.852 on 17 heroes)', () => {
    expect(fieldWalkSpeedCells(2.49, COMPACT_FIELD) / 2.49).toBeCloseTo(0.856, 3);
    expect(fieldWalkSpeedCells(2.49, CLASSIC_FIELD)).toBe(2.49);
  });

  it('clears a squad that takes 45.4 s on the classic field in ~43.0 s, as measured back to back at phase 151', () => {
    const measuredSquad = (hitNoCrit: number) =>
      squad({ presence: 1, fuseSecs: 1.92, walkSpeedCells: 2.49, critChance: 0.3, critMult: 5, hitNoCrit });
    let low = 1e4;
    let high = 1e8;
    for (let i = 0; i < 60; i++) {
      const mid = Math.sqrt(low * high);
      if (simulateClear(measuredSquad(mid), MIX, 100).clearSecs > 45.4) low = mid;
      else high = mid;
    }
    const compact = simulateClear(measuredSquad(Math.sqrt(low * high)), MIX, 100, COMPACT_FIELD);
    expect(compact.clearSecs).toBeGreaterThan(43.0 * 0.98);
    expect(compact.clearSecs).toBeLessThan(43.0 * 1.02);
  });

  it('is faster although each hero plants a little less often, because more props stand under each cross', () => {
    const classic = simulateClear(squad(), MIX, 100);
    const compact = simulateClear(squad(), MIX, 100, COMPACT_FIELD);
    expect(compact.clearSecs).toBeLessThan(classic.clearSecs);
    expect(compact.plantRateByHero[0]).toBeLessThan(classic.plantRateByHero[0]);
    expect(compact.plantRateByHero[0] / classic.plantRateByHero[0]).toBeGreaterThan(0.95);
  });

  it('makes the cooldown cap worth a little less, since slower walking binds more cycles (measured ×1.25 against ×1.29)', () => {
    expect(cdrCapGain(3.2, COMPACT_FIELD)).toBeLessThan(cdrCapGain(3.2));
  });

  it('makes walk speed worth a little more for the same reason', () => {
    const speedGain = (field = CLASSIC_FIELD) =>
      cycleSecondsForHero(1.7, 3.2, 3, field) / cycleSecondsForHero(1.7, 4.2, 3, field);
    expect(speedGain(COMPACT_FIELD)).toBeGreaterThan(speedGain());
  });

  it('caches each field apart, so pricing one never answers for the other', () => {
    const classic = cycleSecondsForHero(1.3, 2.9, 3);
    const compact = cycleSecondsForHero(1.3, 2.9, 3, COMPACT_FIELD);
    expect(compact).not.toBe(classic);
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

  it("prices each hero's own cycle on the account's field, not only the clear", () => {
    const fixture = loadTeamPlanFarmFixture('save-20260831-13heroes-soulbound.json');
    const input = { heroes: fixture.heroes, account: fixture.account, enabledHeroIds: fixture.enabledHeroIds };
    const classic = computeFarmRates(input);
    const viaOption = computeFarmRates({ ...input, field: COMPACT_FIELD });
    const viaAccount = computeFarmRates({ ...input, account: { ...fixture.account, field: COMPACT_FIELD } });
    expect(viaOption.heroFacts[0].cycleSecs).not.toBe(classic.heroFacts[0].cycleSecs);
    expect(viaAccount.heroFacts[0].cycleSecs).toBe(viaOption.heroFacts[0].cycleSecs);
    expect(viaAccount.rows[150].goldPerHour).toBe(viaOption.rows[150].goldPerHour);
  });
});
