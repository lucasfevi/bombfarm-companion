/**
 * Gate rows must not spend the boss's seconds for free.
 *
 * `clearSecs` on a gate is the map PLUS the boss, and the boss drops no props. Every hourly rate
 * — gold, chests, keys, gems, time pieces, stone chests, XP — is `propsPerHour × <per-prop>`, so
 * a `propsPerHour` derived from the boss-free `3600 × propsPerSec` inflates all of them by the
 * boss's share of the cycle. That share grows with phase: ~2% at the first gate, ~10% by the
 * late ones.
 */
import { describe, expect, it } from 'vitest';
import {
  computeFarmRates,
  computeFarmRateRow,
  computeSquadFarmFacts,
  type HeroFarmFacts,
} from '@bombfarm/domain/farm-rate';
import { propCountForAto } from '@bombfarm/domain/phase-wiki';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account } = loadFarmRateFixture();

describe('every row propsPerHour agrees with that row own clearSecs', () => {
  const rows = computeFarmRates({
    heroes,
    account,
    enabledHeroIds: heroes.map((hero) => hero.id),
    returnBonus: 'off',
    maxPhase: 130,
  }).rows.filter((row) => !row.infeasible && row.propsPerHour > 0);

  it('the fixture reaches gate rows at all', () => {
    expect(rows.filter((row) => row.gate).length).toBeGreaterThanOrEqual(4);
  });

  for (const row of rows) {
    it(`phase ${row.phase}${row.gate ? ' (gate)' : ''}`, () => {
      const expected = (3600 / row.clearSecs) * propCountForAto(row.ato);
      const relError = Math.abs(row.propsPerHour - expected) / expected;
      expect(relError).toBeLessThan(1e-12);
    });
  }
});

/**
 * Phases 19 and 20 are both ato 1, so a hero that one-shots every prop AND the boss on both has
 * an identical `propsPerSec` on each — `eHtk` is 1 either side and `hitsPerSec` reads only the
 * ato. The whole difference between the two rows is then the gate boss, which is what makes this
 * a real comparison rather than a restatement of the formula.
 */
describe('the boss costs a gate row real throughput', () => {
  const NON_GATE_PHASE = 19;
  const GATE_PHASE = 20;

  const oneShotEverything: HeroFarmFacts = {
    heroId: 'synthetic',
    heroName: 'synthetic',
    avgHitBase: 1e12,
    penetrationPct: 0,
    fuseSecs: 2,
    walkSpeedCells: 2,
    cycleSecs: 2,
    plantsPerSec: 0.5,
    blocksPerBomb: 1.5,
    uptime: 1,
    heroLuckPct: 0,
    veiaOuroLevel: 0,
    fortunaLevel: 0,
    degenerate: false,
  };

  // Both ceilings inert: one hero at uptime 1 demands no House slot and fills one field slot.
  const squad = computeSquadFarmFacts([oneShotEverything], { ...account, slots: 1000, fieldSlots: 1000 });
  const nonGate = computeFarmRateRow(NON_GATE_PHASE, squad)!;
  const gate = computeFarmRateRow(GATE_PHASE, squad)!;

  it('the two rows differ only in gate-ness', () => {
    expect(nonGate.gate).toBe(false);
    expect(gate.gate).toBe(true);
    expect(gate.ato).toBe(nonGate.ato);
    expect(gate.oneShot).toBe(true);
    expect(nonGate.oneShot).toBe(true);
    expect(gate.expectedHtk).toBeCloseTo(nonGate.expectedHtk, 12);
    expect(gate.infeasible).toBe(false);
  });

  it('the gate cycle is longer, and its hourly rates are lower in the same proportion', () => {
    expect(gate.clearSecs).toBeGreaterThan(nonGate.clearSecs);

    const bossShare = (gate.clearSecs - nonGate.clearSecs) / gate.clearSecs;
    expect(bossShare).toBeGreaterThan(0);

    expect(gate.propsPerHour).toBeLessThan(nonGate.propsPerHour);
    expect(gate.propsPerHour / nonGate.propsPerHour).toBeCloseTo(1 - bossShare, 12);
  });

  it('the boss-free rate is what the gate row must NOT report', () => {
    // `nonGate.propsPerHour` IS `3600 × propsPerSec` for this squad — the old gate expression.
    const bossFree = nonGate.propsPerHour;
    expect(gate.propsPerHour).toBeLessThan(bossFree);
    expect(bossFree / gate.propsPerHour - 1).toBeGreaterThan(0.001);
  });
});
