/**
 * `gateFarmRespec` — Tier 1, the always-on gate and the lower-bound contract it makes.
 */
import { describe, expect, it } from 'vitest';
import { gateFarmRespec, solveFarmRespec, FARM_OPT_GATE_MAX_EVALUATIONS } from '@bombfarm/domain/farm-optimize';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account, maxPhase } = loadFarmRateFixture();

const jon = heroes.find((h) => h.name === 'Jon')!;
const oneCarryRoster = [jon];
const allMinisRoster = heroes.filter((h) => h.name === 'Perrin' || h.name === 'Lyra');

function rosterAlreadyAtOptimum(): HeroRecord[] {
  const first = solveFarmRespec({ heroes, account, maxPhase });
  return heroes.map((hero) => {
    const entry = first.heroes.find((h) => h.heroId === hero.id);
    return entry ? { ...hero, pts: entry.proposedPts } : hero;
  });
}

describe('the lower-bound relation — gateFarmRespec().gainPct <= solveFarmRespec().gainPct', () => {
  const rosters: { label: string; roster: () => readonly HeroRecord[] }[] = [
    { label: 'the fixture', roster: () => heroes },
    { label: 'a one-carry roster', roster: () => oneCarryRoster },
    { label: 'an all-minis roster', roster: () => allMinisRoster },
    { label: 'a roster already at the optimum', roster: rosterAlreadyAtOptimum },
  ];

  for (const { label, roster } of rosters) {
    it(label, () => {
      const r = roster();
      const gate = gateFarmRespec({ heroes: r, account, maxPhase });
      const full = solveFarmRespec({ heroes: r, account, maxPhase });
      expect(gate.gainPct).toBeLessThanOrEqual(full.gainPct);
    });
  }
});

describe('the denominator assertion — the gate never subsamples the current build', () => {
  it("the gate's currentObjective equals a full-sweep evaluation of the current build, to 1e-12 relative", () => {
    const gate = gateFarmRespec({ heroes, account, maxPhase });
    const full = solveFarmRespec({ heroes, account, maxPhase });
    // Both read the SAME current build under the SAME (default gold) objective — a subsampled
    // denominator would diverge from this exact figure.
    expect(gate.currentObjective).toBeCloseTo(full.currentObjective, 6);
    const relError = Math.abs(gate.currentObjective - full.currentObjective) / full.currentObjective;
    expect(relError).toBeLessThan(1e-12);
  });
});

describe('the gate stays inside its own bound', () => {
  it('evaluations <= FARM_OPT_GATE_MAX_EVALUATIONS, and the actual count is 6 on a normal roster', () => {
    const gate = gateFarmRespec({ heroes, account, maxPhase });
    expect(gate.evaluations).toBeLessThanOrEqual(FARM_OPT_GATE_MAX_EVALUATIONS);
    expect(gate.evaluations).toBe(6);
  });
});

describe('the gate\'s own shape', () => {
  it('gainIsLowerBound: true, tier: \'gate\', frontier empty, plateau null', () => {
    const gate = gateFarmRespec({ heroes, account, maxPhase });
    expect(gate.gainIsLowerBound).toBe(true);
    expect(gate.tier).toBe('gate');
    expect(gate.frontier).toHaveLength(0);
    expect(gate.plateau).toBeNull();
  });
});

describe('the non-negative-gain invariant holds for the gate too', () => {
  it('proposedObjective >= currentObjective, gainPct >= 0', () => {
    const gate = gateFarmRespec({ heroes, account, maxPhase });
    expect(gate.proposedObjective).toBeGreaterThanOrEqual(gate.currentObjective);
    expect(gate.gainPct).toBeGreaterThanOrEqual(0);
  });
});

describe('every §7 degenerate row returns the same outcome from the gate as from the full solve', () => {
  it('empty pool', () => {
    expect(gateFarmRespec({ heroes, account, maxPhase, enabledHeroIds: [] }).outcome).toBe(
      solveFarmRespec({ heroes, account, maxPhase, enabledHeroIds: [] }).outcome,
    );
  });

  it('all degenerate', () => {
    const stillJon: HeroRecord = { ...jon, birth: { ...jon.birth!, speed: 0 } };
    expect(gateFarmRespec({ heroes: [stillJon], account, maxPhase }).outcome).toBe(
      solveFarmRespec({ heroes: [stillJon], account, maxPhase }).outcome,
    );
  });

  it('no budget', () => {
    const zeroBudgetJon: HeroRecord = {
      ...jon,
      level: 5,
      pts: { attack: 0, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0, luck: 5 },
    };
    expect(gateFarmRespec({ heroes: [zeroBudgetJon], account, maxPhase }).outcome).toBe(
      solveFarmRespec({ heroes: [zeroBudgetJon], account, maxPhase }).outcome,
    );
  });

  it('an improved roster (normal case)', () => {
    expect(gateFarmRespec({ heroes, account, maxPhase }).outcome).toBe('improved');
    expect(solveFarmRespec({ heroes, account, maxPhase }).outcome).toBe('improved');
  });
});

describe('the gate is pure', () => {
  it('two calls on deep-equal, non-identical inputs are deep-equal', () => {
    const first = loadFarmRateFixture();
    const second = loadFarmRateFixture();
    const gateA = gateFarmRespec({ heroes: first.heroes, account: first.account, maxPhase: first.maxPhase });
    const gateB = gateFarmRespec({ heroes: second.heroes, account: second.account, maxPhase: second.maxPhase });
    expect(gateB).toEqual(gateA);
  });
});
