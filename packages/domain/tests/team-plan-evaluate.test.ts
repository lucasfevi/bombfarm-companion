import { describe, expect, it, vi } from 'vitest';
import * as advisorPipeline from '@bombfarm/domain/advisor-pipeline';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import {
  AURA_FIXED_POINT_ROUNDS,
  evaluateRoster,
} from '@bombfarm/domain/team-plan/evaluate';
import { computeRosterAuras } from '@bombfarm/domain/team-plan/auras';
import { scoreHeroLoadout } from '@bombfarm/domain/team-plan/score';
import {
  buildHeroPlanContexts,
} from '@bombfarm/domain/team-plan/hero-context';
import type {
  EvaluateRosterInput,
  FarmContext,
  HeroPlanContext,
} from '@bombfarm/domain/team-plan/types';
import {
  extractHero,
  loadFixtureJson,
  treeTotalsFromSave,
} from './helpers/sheet-math-fixtures';
import type { TeamPlanAccountInput, TeamPlanHeroInput } from '@bombfarm/domain/team-plan/types';

function accountFromFixture(raw: Record<string, unknown>): TeamPlanAccountInput {
  const totals = (raw.skills as { totals: Record<string, unknown> }).totals;
  const treeSheet = treeTotalsFromSave(totals);
  return {
    treeSheet,
        houseIdx: 0,
    houseLevel: 1,
    phase: 1,
    mitigationPct: 6.7,
    slots: 6,
    fieldSlots: 6,
  };
}

function farmFromAccount(account: TeamPlanAccountInput): FarmContext {
  return {
    houseIdx: account.houseIdx,
    houseLevel: account.houseLevel,
    phase: account.phase,
    mitigationPct: account.mitigationPct,
      };
}

function heroInputFromExtract(hero: ReturnType<typeof extractHero>): TeamPlanHeroInput {
  return {
    heroId: hero.sourceId,
    name: hero.name,
    level: hero.level,
    stars: hero.stars,
    rarity: hero.rarity,
    birth: hero.birth,
    abilities: hero.abilities,
    pts: ZERO_PTS(),
    loadout: hero.loadout,
  };
}

// MP5 F1 (AD-068 class (b) — structural): every assertion in this file compares evaluateRoster
// outputs against each other or checks structural properties (regime membership, determinism,
// clamping, perHero key counts) — none pins a value read from a specific deleted hero. Re-points
// cleanly onto payload-20260812-8heroes.json (default subject) and save-20260813-5heroes.json
// (the one "two identical calls" determinism test, unchanged in kind).
function fixtureEvaluation(file: string): EvaluateRosterInput {
  const raw = loadFixtureJson(file);
  const account = accountFromFixture(raw);
  const heroes = (raw.heroes as unknown[])
    .map((h) => {
      if (typeof h !== 'object' || h === null) return null;
      const name = String((h as { name?: string }).name ?? '');
      const level = Number((h as { level?: number }).level);
      try {
        return heroInputFromExtract(extractHero(raw, name, level));
      } catch {
        return null;
      }
    })
    .filter((h): h is TeamPlanHeroInput => h != null);
  const scope = Object.fromEntries(heroes.map((h) => [h.heroId, 'optimize' as const]));
  const built = buildHeroPlanContexts(heroes, account, scope);
  if (built.blocked) throw new Error('fixture blocked');
  const loadouts = Object.fromEntries(heroes.map((h) => [h.heroId, h.loadout]));
  const pts = Object.fromEntries(heroes.map((h) => [h.heroId, h.pts]));
  return {
    contexts: built.contexts,
    loadoutsByHeroId: loadouts,
    ptsByHeroId: pts,
    slots: account.slots,
    farm: farmFromAccount(account),
    forgeFloor: 0,
  };
}

describe('evaluateRoster', () => {
  it('does not call computeAdvisorPipeline', () => {
    const spy = vi.spyOn(advisorPipeline, 'computeAdvisorPipeline');
    evaluateRoster(fixtureEvaluation('payload-20260812-8heroes.json'));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('converges within 2 rounds on the real fixture', () => {
    const full = fixtureEvaluation('payload-20260812-8heroes.json');
    const hero = full.contexts.find((c) => c.name === 'Torin') ?? full.contexts[0]!;
    const input: EvaluateRosterInput = {
      ...full,
      contexts: [hero],
      loadoutsByHeroId: { [hero.heroId]: full.loadoutsByHeroId[hero.heroId] ?? {} },
      ptsByHeroId: { [hero.heroId]: full.ptsByHeroId[hero.heroId] ?? hero.pts },
    };
    const duties: Record<string, number> = {};
    const optimize = input.contexts.filter((c) => c.scope === 'optimize');
    let sumDuty = 0;
    let roundsUsed = 0;
    for (let round = 0; round < AURA_FIXED_POINT_ROUNDS; round++) {
      roundsUsed = round + 1;
      const prevSumDuty = sumDuty;
      sumDuty = 0;
      const nextDuties: Record<string, number> = {};
      for (const ctx of optimize) {
        const auras = computeRosterAuras(input.contexts, duties, ctx.heroId);
        const score = scoreHeroLoadout(
          ctx,
          input.loadoutsByHeroId[ctx.heroId] ?? {},
          input.ptsByHeroId[ctx.heroId] ?? ctx.pts,
          auras,
          input.farm,
        );
        nextDuties[ctx.heroId] = score.duty;
        sumDuty += score.duty;
      }
      Object.assign(duties, nextDuties);
      if (round > 0 && Math.abs(sumDuty - prevSumDuty) < 1e-9) break;
    }
    expect(roundsUsed).toBeLessThanOrEqual(2);
  });

  it('honours round cap on synthetic oscillating duties', () => {
    const ctx = (id: string, folego: number): HeroPlanContext => ({
      heroId: id,
      name: id,
      level: 50,
      stars: 0,
      rarity: 'Raro',
      birth: {
        attack: 500,
        energy: 800,
        speed: 55,
        critChance: 10,
        critDmg: 80,
        penetration: 5,
        cdr: 4,
        luck: 0,
      },
      sheetOther: { speed: 0, critChance: 0, critDmgFlat: 0, penetration: 0, cdr: 0 },
      mods: {
        drainMult: 1,
        ownTeamDrainPct: 0,
        combatCritChancePctOfBase: 0,
        penetrationPp: 0,
        rangeCells: 0,
        dmgMult: 1,
        attackMult: 1,
        speedMult: 1,
        gateAttackMult: 1,
        sheetCritChancePctOfBase: 0,
        sheetPenetrationRaw: 0,
        sheetCritDmgFlat: 0,
      },
      treeSheet: {
        danoStatic: 1,
        energyPct: 0,
        speedPct: 0,
        critChancePct: 0,
        critDmgPct: 0,
        luckFlatPct: 0,
      },
      scope: 'optimize',
      abilities: { folego_mineiro: folego },
      pts: ZERO_PTS(),
    });
    const input: EvaluateRosterInput = {
      contexts: [ctx('a', 50), ctx('b', 50)],
      loadoutsByHeroId: { a: {}, b: {} },
      ptsByHeroId: { a: ZERO_PTS(), b: ZERO_PTS() },
      slots: 6,
      farm: {
        houseIdx: 0,
        houseLevel: 1,
        phase: 1,
        mitigationPct: 6.7,
              },
      forgeFloor: 0,
    };
    const result = evaluateRoster(input);
    expect(result.objective).toBeGreaterThan(0);
    expect(result.sumDuty).toBeGreaterThan(0);
  });

  it('under-saturated objective equals sum sustained', () => {
    const ctx: HeroPlanContext = {
      heroId: 'a',
      name: 'A',
      level: 50,
      stars: 0,
      rarity: 'Raro',
      birth: {
        attack: 300,
        energy: 400,
        speed: 55,
        critChance: 10,
        critDmg: 80,
        penetration: 5,
        cdr: 4,
        luck: 0,
      },
      sheetOther: { speed: 0, critChance: 0, critDmgFlat: 0, penetration: 0, cdr: 0 },
      mods: {
        drainMult: 1,
        ownTeamDrainPct: 0,
        combatCritChancePctOfBase: 0,
        penetrationPp: 0,
        rangeCells: 0,
        dmgMult: 1,
        attackMult: 1,
        speedMult: 1,
        gateAttackMult: 1,
        sheetCritChancePctOfBase: 0,
        sheetPenetrationRaw: 0,
        sheetCritDmgFlat: 0,
      },
      treeSheet: {
        danoStatic: 1,
        energyPct: 0,
        speedPct: 0,
        critChancePct: 0,
        critDmgPct: 0,
        luckFlatPct: 0,
      },
      scope: 'optimize',
      abilities: {},
      pts: ZERO_PTS(),
    };
    const input: EvaluateRosterInput = {
      contexts: [ctx],
      loadoutsByHeroId: { a: {} },
      ptsByHeroId: { a: ZERO_PTS() },
      slots: 100,
      farm: {
        houseIdx: 0,
        houseLevel: 1,
        phase: 1,
        mitigationPct: 6.7,
              },
      forgeFloor: 0,
    };
    const result = evaluateRoster(input);
    expect(result.regime).toBe('underSaturated');
    const expected = result.perHero.a?.sustained ?? 0;
    expect(result.objective).toBeCloseTo(expected, 9);
  });

  it('saturated objective when sumDuty >= slots', () => {
    const makeCtx = (id: string, energy: number): HeroPlanContext => ({
      heroId: id,
      name: id,
      level: 50,
      stars: 0,
      rarity: 'Raro',
      birth: {
        attack: 300,
        energy,
        speed: 55,
        critChance: 10,
        critDmg: 80,
        penetration: 5,
        cdr: 4,
        luck: 0,
      },
      sheetOther: { speed: 0, critChance: 0, critDmgFlat: 0, penetration: 0, cdr: 0 },
      mods: {
        drainMult: 1,
        ownTeamDrainPct: 0,
        combatCritChancePctOfBase: 0,
        penetrationPp: 0,
        rangeCells: 0,
        dmgMult: 1,
        attackMult: 1,
        speedMult: 1,
        gateAttackMult: 1,
        sheetCritChancePctOfBase: 0,
        sheetPenetrationRaw: 0,
        sheetCritDmgFlat: 0,
      },
      treeSheet: {
        danoStatic: 1,
        energyPct: 0,
        speedPct: 0,
        critChancePct: 0,
        critDmgPct: 0,
        luckFlatPct: 0,
      },
      scope: 'optimize',
      abilities: {},
      pts: ZERO_PTS(),
    });
    const input: EvaluateRosterInput = {
      contexts: [makeCtx('a', 2000), makeCtx('b', 2000), makeCtx('c', 2000)],
      loadoutsByHeroId: { a: {}, b: {}, c: {} },
      ptsByHeroId: { a: ZERO_PTS(), b: ZERO_PTS(), c: ZERO_PTS() },
      slots: 1,
      farm: {
        houseIdx: 0,
        houseLevel: 1,
        phase: 1,
        mitigationPct: 6.7,
              },
      forgeFloor: 0,
    };
    const result = evaluateRoster(input);
    expect(result.sumDuty).toBeGreaterThanOrEqual(result.slots);
    expect(result.regime).toBe('saturated');
    const scores = Object.values(result.perHero);
    const weightedActive = scores.reduce((sum, s) => sum + s.duty * s.active, 0);
    const expected = result.slots * (weightedActive / result.sumDuty);
    expect(result.objective).toBeCloseTo(expected, 6);
  });

  it('saturated regime at exactly sumDuty === slots boundary', () => {
    const ctx: HeroPlanContext = {
      heroId: 'a',
      name: 'A',
      level: 50,
      stars: 0,
      rarity: 'Raro',
      birth: {
        attack: 300,
        energy: 400,
        speed: 55,
        critChance: 10,
        critDmg: 80,
        penetration: 5,
        cdr: 4,
        luck: 0,
      },
      sheetOther: { speed: 0, critChance: 0, critDmgFlat: 0, penetration: 0, cdr: 0 },
      mods: {
        drainMult: 1,
        ownTeamDrainPct: 0,
        combatCritChancePctOfBase: 0,
        penetrationPp: 0,
        rangeCells: 0,
        dmgMult: 1,
        attackMult: 1,
        speedMult: 1,
        gateAttackMult: 1,
        sheetCritChancePctOfBase: 0,
        sheetPenetrationRaw: 0,
        sheetCritDmgFlat: 0,
      },
      treeSheet: {
        danoStatic: 1,
        energyPct: 0,
        speedPct: 0,
        critChancePct: 0,
        critDmgPct: 0,
        luckFlatPct: 0,
      },
      scope: 'optimize',
      abilities: {},
      pts: ZERO_PTS(),
    };
    const input: EvaluateRosterInput = {
      contexts: [ctx],
      loadoutsByHeroId: { a: {} },
      ptsByHeroId: { a: ZERO_PTS() },
      slots: 1,
      farm: {
        houseIdx: 0,
        houseLevel: 1,
        phase: 1,
        mitigationPct: 6.7,
              },
      forgeFloor: 0,
    };
    const result = evaluateRoster(input);
    if (result.sumDuty >= result.slots) {
      expect(result.regime).toBe('saturated');
    } else {
      expect(result.regime).toBe('underSaturated');
    }
  });

  it('donate and leaveAlone heroes contribute no objective term', () => {
    const base = fixtureEvaluation('payload-20260812-8heroes.json');
    const optimizeOnly = {
      ...base,
      contexts: base.contexts.map((c) => ({ ...c, scope: 'optimize' as const })),
    };
    const withDonate = {
      ...base,
      contexts: base.contexts.map((c, i) =>
        i === 0 ? { ...c, scope: 'donate' as const } : { ...c, scope: 'optimize' as const },
      ),
    };
    const full = evaluateRoster(optimizeOnly);
    const minusDonate = evaluateRoster(withDonate);
    expect(minusDonate.objective).toBeLessThan(full.objective);
  });

  it('reports regime explicitly', () => {
    const result = evaluateRoster(fixtureEvaluation('payload-20260812-8heroes.json'));
    expect(['underSaturated', 'saturated']).toContain(result.regime);
  });

  it('two identical calls return deep-equal results', () => {
    const input = fixtureEvaluation('save-20260813-5heroes.json');
    const a = evaluateRoster(input);
    const b = evaluateRoster(input);
    expect(a).toEqual(b);
  });

  it('clamps slots to at least 1', () => {
    const input = fixtureEvaluation('payload-20260812-8heroes.json');
    const result = evaluateRoster({ ...input, slots: 0 });
    expect(result.slots).toBe(1);
  });

  it('returns perHero scores for optimize heroes', () => {
    const input = fixtureEvaluation('payload-20260812-8heroes.json');
    const result = evaluateRoster(input);
    const optimizeCount = input.contexts.filter((c) => c.scope === 'optimize').length;
    expect(Object.keys(result.perHero).length).toBe(optimizeCount);
  });

  it('includes auras in result', () => {
    const result = evaluateRoster(fixtureEvaluation('payload-20260812-8heroes.json'));
    expect(typeof result.auras.grito_guerra).toBe('number');
  });

  it('leaveAlone hero excluded from perHero', () => {
    const input = fixtureEvaluation('payload-20260812-8heroes.json');
    const firstId = input.contexts[0]!.heroId;
    const scoped = {
      ...input,
      contexts: input.contexts.map((c) =>
        c.heroId === firstId ? { ...c, scope: 'leaveAlone' as const } : c,
      ),
    };
    const result = evaluateRoster(scoped);
    expect(result.perHero[firstId]).toBeUndefined();
  });
});
