/**
 * Every degenerate/boundary case named in the design's Edge Cases table, each asserting the
 * full pinned tuple rather than a single field. No public field may be `NaN`.
 */
import { describe, expect, it } from 'vitest';
import {
  computeHeroFarmFacts,
  computeSquadFarmFacts,
  computeFarmRateRow,
  type HeroFarmFacts,
} from '@bombfarm/domain/farm-rate';
import {
  wikiPhaseLine,
  WIKI_PROPS,
  BOSS_HP_MULT_WIKI,
  GATE_SECS_POR_ATO,
  propCountForAto,
} from '@bombfarm/domain/phase-wiki';
import { hitsToKill, propHp } from '@bombfarm/domain/phases';
import { mitigationFactor, EFF_IA } from '@bombfarm/domain/model';
import { DEFAULT_CASA_SLOTS } from '@bombfarm/domain/casa-slots';
import type { AccountShared, HeroRecord } from '@bombfarm/domain/shims/storage';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account } = loadFarmRateFixture();

function syntheticHero(overrides: Partial<HeroFarmFacts> & { heroId: string }): HeroFarmFacts {
  return {
    heroName: overrides.heroId,
    avgHitBase: 100,
    penetrationPct: 0,
    fuseSecs: 2,
    walkSpeedCells: 2,
    cycleSecs: 2,
    plantsPerSec: 0.5,
    blocksPerBomb: 1.5,
    uptime: 0.5,
    heroLuckPct: 0,
    veiaOuroLevel: 0,
    fortunaLevel: 0,
    degenerate: false,
    ...overrides,
  };
}

function expectNoNaN(row: ReturnType<typeof computeFarmRateRow>): void {
  if (!row) return;
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'number') {
      expect(Number.isNaN(value), `${key} is NaN`).toBe(false);
    }
  }
}

describe('empty pool', () => {
  it('every rate 0, clearSecs Infinity, expectedHtk Infinity, oneShot false, infeasible true, concurrencyScale 1, sorteFraction is the tree contribution alone, fortunaAura 0', () => {
    const squad = computeSquadFarmFacts([], account);
    expect(squad.houseSlotDemand).toBe(0);
    expect(squad.sorteFraction).toBeCloseTo((account.tree.luckFlatPct ?? 0) / 100, 15);

    const row = computeFarmRateRow(42, squad)!;
    expectNoNaN(row);
    expect(row.goldPerHour).toBe(0);
    expect(row.chestsPerHour).toBe(0);
    expect(row.keysPerHour).toBe(0);
    expect(row.xpPerHour).toBe(0);
    expect(row.propsPerHour).toBe(0);
    expect(row.cyclesPerHour).toBe(0);
    expect(row.clearSecs).toBe(Infinity);
    expect(row.expectedHtk).toBe(Infinity);
    expect(row.oneShot).toBe(false);
    expect(row.infeasible).toBe(true);
    // The two ceilings on an empty pool: nothing on field, and the field cap's 0/0 guard holds.
    expect(row.heroesOnField).toBe(0);
    expect(row.concurrencyScale).toBe(1);
    expect(row.fortunaAura).toBe(0);
  });
});

describe('all heroes degenerate', () => {
  it('is identical to the zero-hero row except sorteFraction/fortunaAura still reflect the degenerate heroes', () => {
    const emptySquad = computeSquadFarmFacts([], account);
    const emptyRow = computeFarmRateRow(42, emptySquad)!;

    const allDegenerate: HeroFarmFacts[] = [
      syntheticHero({ heroId: 'd1', avgHitBase: 0, degenerate: true, heroLuckPct: 20, fortunaLevel: 20, uptime: 1 }),
      syntheticHero({ heroId: 'd2', plantsPerSec: 0, cycleSecs: Infinity, degenerate: true, heroLuckPct: 10, uptime: 1 }),
    ];
    const degenerateSquad = computeSquadFarmFacts(allDegenerate, account);
    const row = computeFarmRateRow(42, degenerateSquad)!;
    expectNoNaN(row);

    // Structurally identical to the zero-hero row (nothing here can produce throughput).
    expect(row.goldPerHour).toBe(emptyRow.goldPerHour);
    expect(row.chestsPerHour).toBe(emptyRow.chestsPerHour);
    expect(row.keysPerHour).toBe(emptyRow.keysPerHour);
    expect(row.xpPerHour).toBe(emptyRow.xpPerHour);
    expect(row.propsPerHour).toBe(emptyRow.propsPerHour);
    expect(row.clearSecs).toBe(Infinity);
    expect(row.expectedHtk).toBe(Infinity);
    expect(row.oneShot).toBe(false);
    expect(row.infeasible).toBe(true);

    // ...but sorteFraction/fortunaAura genuinely differ — they still reflect these heroes.
    expect(degenerateSquad.sorteFraction).not.toBeCloseTo(emptySquad.sorteFraction, 6);
    expect(row.fortunaAura).toBeGreaterThan(0);
  });
});

describe('one degenerate hero among healthy ones (design.md §4.6)', () => {
  it('the degenerate hero contributes 0; the healthy ones still produce a normal, finite row', () => {
    const facts: HeroFarmFacts[] = [
      syntheticHero({ heroId: 'healthy-1', avgHitBase: 500, uptime: 0.3 }),
      syntheticHero({ heroId: 'dead', avgHitBase: 0, degenerate: true, uptime: 0.3 }),
      syntheticHero({ heroId: 'healthy-2', avgHitBase: 300, uptime: 0.3 }),
    ];
    const squad = computeSquadFarmFacts(facts, account);
    const row = computeFarmRateRow(42, squad)!;
    expectNoNaN(row);
    expect(row.propsPerHour).toBeGreaterThan(0);
    expect(row.goldPerHour).toBeGreaterThan(0);
    expect(row.infeasible).toBe(false);
    expect(Number.isFinite(row.clearSecs)).toBe(true);
    expect(Number.isFinite(row.expectedHtk)).toBe(true);
  });
});

describe('w <= 0 (design.md §4.6)', () => {
  it('cycleSecs Infinity, plantsPerSec 0, degenerate true — a hero that cannot reach the next plant contributes nothing', () => {
    const jon = heroes.find((h) => h.name === 'Jon')!;
    const stillJon: HeroRecord = { ...jon, birth: { ...jon.birth!, speed: 0 } };
    const [fact] = computeHeroFarmFacts({ heroes: [stillJon], account });
    expect(fact.cycleSecs).toBe(Infinity);
    expect(fact.plantsPerSec).toBe(0);
    expect(fact.degenerate).toBe(true);

    const squad = computeSquadFarmFacts([fact], account);
    const row = computeFarmRateRow(42, squad)!;
    expectNoNaN(row);
    expect(row.propsPerHour).toBe(0);
    expect(row.clearSecs).toBe(Infinity);
    expect(row.infeasible).toBe(true);
  });
});

describe('avgHitBase <= 0 (design.md §4.6)', () => {
  it('the hero is degenerate, contributes 0 to every squad sum, and produces no NaN in expectedHtk/share/goldPerHour', () => {
    const facts: HeroFarmFacts[] = [syntheticHero({ heroId: 'zero-hit', avgHitBase: 0, degenerate: true })];
    const squad = computeSquadFarmFacts(facts, account);
    const row = computeFarmRateRow(42, squad)!;
    expectNoNaN(row);
    expect(row.propsPerHour).toBe(0);
    expect(row.goldPerHour).toBe(0);
    expect(row.expectedHtk).toBe(Infinity);
  });
});

describe('gate over timer, and the strict > boundary (design.md §4.6, spec.md Edge Cases)', () => {
  const PROP_WEIGHT_TOTAL = WIKI_PROPS.reduce((sum, prop) => sum + prop.weight, 0);
  function handEHtk(stoneHp: number, avgHit: number): number {
    return WIKI_PROPS.reduce(
      (sum, prop) => sum + (prop.weight / PROP_WEIGHT_TOTAL) * hitsToKill(avgHit, propHp(stoneHp, prop.hpMult)),
      0,
    );
  }

  it('a squad far too slow for the gate timer is infeasible: true', () => {
    const facts: HeroFarmFacts[] = [syntheticHero({ heroId: 'slow', avgHitBase: 1, plantsPerSec: 0.001, uptime: 0.05 })];
    const squad = computeSquadFarmFacts(facts, { ...account, slots: 100 });
    const row = computeFarmRateRow(10, squad)!;
    expectNoNaN(row);
    expect(row.gate).toBe(true);
    expect(row.gateTimerSecs).toBe(600);
    expect(row.clearSecs).toBeGreaterThan(row.gateTimerSecs!);
    expect(row.infeasible).toBe(true);
  });

  it('the strict ">" boundary: clearSecs just at-or-under the timer is feasible; just over is infeasible', () => {
    // Construction: an astronomically large avgHit one-shots every prop AND the boss, so
    // eHtk === bossHtk === 1 exactly (Math.ceil of a value in (0,1] is 1). That collapses
    // clearSecs to a single-hero closed form the test can invert exactly:
    //   clearSecs = (propCount × eHtk + bossHtk) / (plantsPerSec × blocksPerBomb × EFF_IA × uptime)
    // solved here for plantsPerSec given a target clearSecs, then fed back through the real
    // computeFarmRateRow. A tiny (1e-6s) offset on each side absorbs floating-point rounding
    // while still proving the comparison is strict ">" and not ">=" (spec.md: "exactly the gate
    // timer ⇒ infeasible false").
    const line = wikiPhaseLine(10)!;
    const gateTimerSecs = GATE_SECS_POR_ATO[line.ato - 1]!;
    const propCount = propCountForAto(line.ato);
    const avgHitBase = 1e9;
    const mitF = mitigationFactor(line.mitig, 0);
    const avgHit = avgHitBase * mitF;
    const eHtk = handEHtk(line.hp, avgHit);
    const bossHtk = hitsToKill(avgHit, propHp(line.hp, BOSS_HP_MULT_WIKI));
    expect(eHtk).toBe(1);
    expect(bossHtk).toBe(1);

    function buildSquad(targetClearSecs: number) {
      const requiredRate = (propCount * eHtk + bossHtk) / targetClearSecs;
      const plantsPerSec = requiredRate / EFF_IA;
      const hero: HeroFarmFacts = syntheticHero({ heroId: 'boundary', avgHitBase, plantsPerSec, blocksPerBomb: 1, uptime: 1 });
      return computeSquadFarmFacts([hero], { ...account, slots: 1000 });
    }

    const belowRow = computeFarmRateRow(10, buildSquad(gateTimerSecs - 1e-6))!;
    const aboveRow = computeFarmRateRow(10, buildSquad(gateTimerSecs + 1e-6))!;
    expectNoNaN(belowRow);
    expectNoNaN(aboveRow);

    expect(belowRow.clearSecs).toBeLessThanOrEqual(gateTimerSecs);
    expect(belowRow.infeasible).toBe(false);

    expect(aboveRow.clearSecs).toBeGreaterThan(gateTimerSecs);
    expect(aboveRow.infeasible).toBe(true);
  });
});

describe('unbounded clear on a non-gate row is also infeasible', () => {
  it('a zero-hero non-gate row has clearSecs Infinity and infeasible true', () => {
    const squad = computeSquadFarmFacts([], account);
    const row = computeFarmRateRow(42, squad)!;
    expect(row.gate).toBe(false);
    expect(row.clearSecs).toBe(Infinity);
    expect(row.infeasible).toBe(true);
  });
});

describe('account.slots absent', () => {
  it('both slot counts fall back to DEFAULT_CASA_SLOTS — not 0, not Infinity', () => {
    const heroFacts = computeHeroFarmFacts({ heroes, account });
    // `fieldSlots: null` too: with `slots` absent AND no `skills.field_slots`, the field cap has
    // no source left and must reach the same documented default rather than 0 or Infinity.
    const noSlots: AccountShared = { ...account, slots: undefined, fieldSlots: null };
    const squad = computeSquadFarmFacts(heroFacts, noSlots);
    expect(squad.fieldSlots).toBe(DEFAULT_CASA_SLOTS);
    expect(squad.houseSlots).toBe(DEFAULT_CASA_SLOTS);
    expect(squad.fieldSlots).not.toBe(0);
    expect(Number.isFinite(squad.fieldSlots)).toBe(true);
  });
});

describe('negative tree.teamCoinPct (spec.md Edge Cases)', () => {
  it('is clamped at 0 before use — teamCoinMult is exactly 1', () => {
    const heroFacts = computeHeroFarmFacts({ heroes, account });
    const negativeAccount: AccountShared = { ...account, tree: { ...account.tree, teamCoinPct: -50 } };
    const squad = computeSquadFarmFacts(heroFacts, negativeAccount);
    expect(squad.teamCoinMult).toBe(1);
    const row = computeFarmRateRow(42, squad)!;
    expectNoNaN(row);
  });
});

describe('tree.luckFlatPct undefined (spec.md Edge Cases)', () => {
  it('is treated as 0 — sorteFraction is the uptime-weighted hero average alone', () => {
    const heroFacts = computeHeroFarmFacts({ heroes, account });
    const noLuckAccount: AccountShared = { ...account, tree: { ...account.tree, luckFlatPct: undefined } };
    const squad = computeSquadFarmFacts(heroFacts, noLuckAccount);
    expect(squad.treeLuckFlatPct).toBe(0);
    const row = computeFarmRateRow(42, squad)!;
    expectNoNaN(row);
  });
});

describe('duplicate hero ids in heroes[] (spec.md Edge Cases)', () => {
  it('both are counted — HeroRecord.id uniqueness is not enforced here', () => {
    const jon = heroes.find((h) => h.name === 'Jon')!;
    const dupedHeroes = [...heroes, { ...jon }];
    const facts = computeHeroFarmFacts({ heroes: dupedHeroes, account });
    expect(facts.filter((f) => f.heroId === jon.id)).toHaveLength(2);
    expect(facts).toHaveLength(heroes.length + 1);
  });
});

describe('phase 600 (hp 5.25e11) stays finite (spec.md Edge Cases)', () => {
  it('a very large hp underflows propsPerHour toward 0 but never produces Infinity/NaN off a healthy squad', () => {
    const heroFacts = computeHeroFarmFacts({ heroes, account });
    const squad = computeSquadFarmFacts(heroFacts, account);
    const line = wikiPhaseLine(600)!;
    expect(line.hp).toBe(525_000_000_000);

    const row = computeFarmRateRow(600, squad)!;
    expectNoNaN(row);
    expect(Number.isFinite(row.propsPerHour)).toBe(true);
    expect(Number.isFinite(row.expectedHtk)).toBe(true);
    expect(row.propsPerHour).toBeGreaterThanOrEqual(0);
  });
});

describe("non-gate keysPerHour is 0, not -0, when the squad is degenerate (spec.md Edge Cases)", () => {
  it('Object.is(row.keysPerHour, -0) is false', () => {
    const squad = computeSquadFarmFacts([], account);
    const row = computeFarmRateRow(42, squad)!;
    expect(row.gate).toBe(false);
    expect(row.keysPerHour).toBe(0);
    expect(Object.is(row.keysPerHour, -0)).toBe(false);
  });
});

describe('out-of-range phase for computeFarmRateRow', () => {
  it.each([0, 601, -1, NaN, 42.5])('phase %p returns null, never a clamped row', (phase) => {
    const squad = computeSquadFarmFacts([], account);
    expect(computeFarmRateRow(phase, squad)).toBeNull();
  });
});
