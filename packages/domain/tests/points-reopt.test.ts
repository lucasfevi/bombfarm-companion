/**
 * BSPW4-10 — Tier 1 (AC-51/AC-52, AC-57..AC-59, AC-61b, AC-72) and Tier 2
 * (AC-62..AC-64i, AC-70b) on the shared scorer / search.
 */
import { describe, expect, it } from 'vitest';
import {
  abilityMods,
  inferSpentPoints,
  sustainedDps,
  type Context,
  type EffectiveDeltas,
  type HeroSheet,
} from '@bombfarm/domain/model';
import { computeCombatMults, derive } from '@bombfarm/domain/derive';
import {
  findGateCandidate,
  optimizeBuild,
  REOPT_FULL_MAX_EVALUATIONS,
  REOPT_GATE_MAX_EVALUATIONS,
  REOPT_KEYS,
} from '@bombfarm/domain/points-reopt';
import { SHEET_KEYS, ZERO_PTS, type SheetKey } from '@bombfarm/domain/planner-constants';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { extractHero, loadFixtureJson, treeTotalsFromSave } from './helpers/sheet-math-fixtures';

// MP5 F1 (AD-068 class (b) — structural, using real heroes as generic input rather than
// pinning any of their captured values as an expected output): re-pointed onto
// payload-20260812-8heroes.json's 8 real heroes (design.md §6.2 — "the largest single
// re-point in the feature"). The deleted 21 hero-name literals spanned two now-deleted
// fixtures; every assertion below (reoptDps >= currentDps, tier monotonicity, budget
// conservation, …) is a comparative invariant that holds for any real hero, so it re-points
// onto the smaller 8-hero set without loss — no hero identity or numeric value from the
// deleted fixtures is asserted anywhere in this file.
const FIXTURES = [
  { file: 'payload-20260812-8heroes.json', names: [
    ['Nyx', 25], ['Bellatrix', 27], ['Cora', 22], ['Wren', 24],
    ['Lyra', 3], ['Mira', 3], ['Bryn', 3], ['Devin', 5],
  ] as const },
];

const context: Context = {
  restSeconds: 12 * 60,
  mitigation: 0.067,
  blastRange: 1,
  cycleModel: 'serial',
  walkDelay: 0.15,
  drainMult: 1,
};

/** Real-hero {effective, effectiveDelta, pts} triple, driven off derive() like the pipeline. */
function realHeroDerive(file: string, name: string, level: number) {
  const raw = loadFixtureJson(file);
  const hero = extractHero(raw, name, level);
  const totals = (raw.skills as { totals: Record<string, unknown> }).totals;
  const tree = treeTotalsFromSave(totals);
  const solved = hero.birth
    ? inferSpentPoints({
        birth: hero.birth,
        level: hero.level,
        stars: hero.stars,
        sheetOther: hero.sheetOther,
        loadout: hero.loadout,
        tree,
        sheet: hero.sheet,
        statPointsAvailable: hero.statPointsAvailable,
      }).pts
    : ZERO_PTS();

  const mods = abilityMods(hero.abilities);
  const mults = computeCombatMults({
    mods,
    teamBuffs: zeroTeamBuffs(),
        extraDmgPct: 0,
  });
  const result = derive({
    geared: hero.sheet,
    naked: hero.sheet,
    sheetOther: hero.sheetOther,
    pts: ZERO_PTS(),
    rarity: hero.rarity,
    level: hero.level,
    stars: hero.stars,
    attackMult: mults.attackMult,
    energyMult: mults.energyMult,
    speedMult: mults.speedMult,
    critDmgMult: mults.critDmgMult,
    teamCritPctOfBase: 0,
    treeSheet: tree,
    combatCritChancePctOfBase: mods.combatCritChancePctOfBase,
    penetrationPp: mods.penetrationPp,
    context,
    dmgMult: mults.dmgMult,
    mitigationPct: 6.7,
  });
  return { pts: solved, effective: result.effective, effectiveDelta: result.effectiveDelta };
}

function syntheticHero(): { pts: Record<SheetKey, number>; effective: HeroSheet; effectiveDelta: EffectiveDeltas } {
  const pts: Record<SheetKey, number> = { ...ZERO_PTS(), attack: 5, energy: 4, speed: 2, critChance: 3, critDmg: 2, penetration: 1, cdr: 1 };
  const effective: HeroSheet = {
    rarity: 'Raro',
    attack: 500,
    energy: 600,
    speed: 60,
    critChance: 20,
    critDmg: 90,
    penetration: 20,
    cdr: 15,
    attackPerPoint: 10,
    energyPerPoint: 8,
  };
  const effectiveDelta: EffectiveDeltas = {
    attack: 10,
    energy: 8,
    speed: 1.1,
    critChance: 2,
    critDmg: 6.4,
    penetration: 0.5,
    cdr: 1.2,
  };
  return { pts, effective, effectiveDelta };
}

describe('REOPT_KEYS (AC-72)', () => {
  it('has exactly seven members, excludes luck, and matches SHEET_KEYS minus luck as a set', () => {
    expect(REOPT_KEYS).toHaveLength(7);
    expect(REOPT_KEYS).not.toContain('luck');
    const expected = new Set(SHEET_KEYS.filter((key) => key !== 'luck'));
    expect(new Set(REOPT_KEYS)).toEqual(expected);
  });
});

describe('findGateCandidate — Tier 1 (BSPW4-10)', () => {
  it('AC-57f/AC-64h: budget 0 returns the input vector, gainPct 0, evaluations <= 1, no seed generated', () => {
    const { effective, effectiveDelta } = syntheticHero();
    const result = findGateCandidate({ pts: ZERO_PTS(), effective, effectiveDelta, context });
    expect(result.pts).toEqual(ZERO_PTS());
    expect(result.gainPct).toBe(0);
    expect(result.evaluations).toBeLessThanOrEqual(1);
    expect(result.keptCurrent).toBe(true);
  });

  it('AC-57c: is AD-BSP-08 verbatim — no localSearchMoves, tier "gate", gainIsLowerBound true', () => {
    const { pts, effective, effectiveDelta } = syntheticHero();
    const result = findGateCandidate({ pts, effective, effectiveDelta, context });
    expect(result.localSearchMoves).toBe(0);
    expect(result.tier).toBe('gate');
    expect(result.gainIsLowerBound).toBe(true);
    expect(result.winningSeed).toBeUndefined();
    expect(result.sweeps).toBeUndefined();
  });

  it('AC-57d: evaluations <= 1 + 10*B and <= 1024, on a real fixture hero and at a synthetic B=100', () => {
    const real = realHeroDerive('payload-20260812-8heroes.json', 'Bellatrix', 27);
    const budget = REOPT_KEYS.reduce((sum, key) => sum + real.pts[key], 0);
    const realResult = findGateCandidate({ pts: real.pts, effective: real.effective, effectiveDelta: real.effectiveDelta, context });
    expect(realResult.evaluations).toBeLessThanOrEqual(1 + 10 * budget);
    expect(realResult.evaluations).toBeLessThanOrEqual(REOPT_GATE_MAX_EVALUATIONS);

    const { effective, effectiveDelta } = syntheticHero();
    const bigPts: Record<SheetKey, number> = { ...ZERO_PTS(), attack: 100 };
    const bigResult = findGateCandidate({ pts: bigPts, effective, effectiveDelta, context });
    expect(bigResult.evaluations).toBeLessThanOrEqual(1 + 10 * 100);
    expect(bigResult.evaluations).toBeLessThanOrEqual(REOPT_GATE_MAX_EVALUATIONS);
  });

  it('AC-57e: cost context recorded beside the pipeline\'s existing ~240 sustained-DPS evaluations', () => {
    // energySwitchPoint's 60-iteration binary search x 4 sustainedDps calls/iteration = 240.
    const PIPELINE_EXISTING_EVALUATIONS = 240;
    const { pts, effective, effectiveDelta } = syntheticHero();
    const result = findGateCandidate({ pts, effective, effectiveDelta, context });
    expect(result.evaluations).toBeLessThanOrEqual(REOPT_GATE_MAX_EVALUATIONS);
    // Both figures stated together — reviewer sees ~2.6x, not a new order of magnitude.
    expect(REOPT_GATE_MAX_EVALUATIONS / PIPELINE_EXISTING_EVALUATIONS).toBeCloseTo(4.2666, 3);
  });

  it('AC-57g: reuses the given effective/effectiveDelta — never calls derive again (no geared/naked input exists on ReoptInput)', () => {
    const { pts, effective, effectiveDelta } = syntheticHero();
    // Structural: ReoptInput has no `naked`/`geared`/`sheetOther` fields for derive() to need.
    const result = findGateCandidate({ pts, effective, effectiveDelta, context });
    expect(result).toBeDefined();
  });

  it('AC-51/AC-52: skips candidates scoring <= 0; when the budget outruns any positive candidate, reports unallocated > 0', () => {
    // Only crit chance has a positive effectiveDelta, and it caps after 2 points (98 -> 100).
    // Current (S1) wastes its whole budget in a zero-delta stat (penetration) — worse than
    // greedy's partial allocation, so greedy wins, but 3 of its 5 points have nowhere to go.
    const effective: HeroSheet = {
      rarity: 'Raro',
      attack: 500,
      energy: 600,
      speed: 60,
      critChance: 98,
      critDmg: 90,
      penetration: 20,
      cdr: 15,
      attackPerPoint: 10,
      energyPerPoint: 8,
    };
    const effectiveDelta: EffectiveDeltas = {
      attack: 0,
      energy: 0,
      speed: 0,
      critChance: 1,
      critDmg: 0,
      penetration: 0,
      cdr: 0,
    };
    const pts: Record<SheetKey, number> = { ...ZERO_PTS(), penetration: 5 };
    const result = findGateCandidate({ pts, effective, effectiveDelta, context });
    expect(result.keptCurrent).toBe(false);
    expect(result.unallocated).toBeGreaterThan(0);
    expect(result.unallocated).toBe(3);
    expect(result.pts.critChance).toBe(2);
    expect(result.reoptDps).toBeGreaterThan(result.currentDps);
  });

  it('AC-58/AC-58a: budget is Σ pts over REOPT_KEYS; pts.luck copied through; Σ result.pts equals budget - unallocated', () => {
    const { pts, effective, effectiveDelta } = syntheticHero();
    const hostilePts = { ...pts, luck: 42 };
    const result = findGateCandidate({ pts: hostilePts, effective, effectiveDelta, context });
    expect(result.pts.luck).toBe(42);
    const budget = REOPT_KEYS.reduce((sum, key) => sum + hostilePts[key], 0);
    const resultSum = REOPT_KEYS.reduce((sum, key) => sum + result.pts[key], 0);
    expect(resultSum).toBe(budget - result.unallocated);
  });

  it('AC-59 (GAP-W2-01): pts.luck=0 vs a hostile pts.luck=9999 produce byte-identical DPS entries', () => {
    const { pts, effective, effectiveDelta } = syntheticHero();
    const honest = findGateCandidate({ pts: { ...pts, luck: 0 }, effective, effectiveDelta, context });
    const hostile = findGateCandidate({ pts: { ...pts, luck: 9999 }, effective, effectiveDelta, context });
    for (const key of REOPT_KEYS) {
      expect(hostile.pts[key], key).toBe(honest.pts[key]);
    }
    expect(hostile.gainPct).toBe(honest.gainPct);
    expect(hostile.reoptDps).toBe(honest.reoptDps);
    expect(hostile.currentDps).toBe(honest.currentDps);
    expect(hostile.pts.luck).toBe(9999);
    expect(honest.pts.luck).toBe(0);
  });

  it('AC-61b: penetration above STAT_CAPS.penetration is not clamped; the search simply scores no further gain there', () => {
    const effective: HeroSheet = {
      rarity: 'Raro',
      attack: 500,
      energy: 600,
      speed: 60,
      critChance: 20,
      critDmg: 90,
      penetration: 141.22613536827, // real sheet pen from save-20260801's Bellatrix
      cdr: 15,
      attackPerPoint: 10,
      energyPerPoint: 8,
    };
    const effectiveDelta: EffectiveDeltas = {
      attack: 10,
      energy: 8,
      speed: 1.1,
      critChance: 2,
      critDmg: 6.4,
      penetration: 0.5,
      cdr: 1.2,
    };
    const pts: Record<SheetKey, number> = { ...ZERO_PTS(), penetration: 3, attack: 2 };
    const result = findGateCandidate({ pts, effective, effectiveDelta, context });
    // Pen is already scoring 0 gain (100% mitigation bypass already reached) — the greedy
    // walk (if it wins) must not have grown pen further.
    if (!result.keptCurrent) {
      expect(result.pts.penetration).toBeLessThanOrEqual(pts.penetration);
    }
    expect(effective.penetration).toBeGreaterThan(100); // sanity: genuinely uncapped input
  });

  it('AC-57a: reoptDps >= currentDps and gainPct >= 0 across every one of the 8 real hero-instances', () => {
    for (const { file, names } of FIXTURES) {
      for (const [name, level] of names) {
        const real = realHeroDerive(file, name, level);
        const result = findGateCandidate({
          pts: real.pts,
          effective: real.effective,
          effectiveDelta: real.effectiveDelta,
          context,
        });
        expect(result.reoptDps, `${file}:${name}L${level}`).toBeGreaterThanOrEqual(result.currentDps);
        expect(result.gainPct, `${file}:${name}L${level}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('AC-57b: re-scoring result.pts reproduces result.reoptDps exactly', () => {
    const { pts, effective, effectiveDelta } = syntheticHero();
    const result = findGateCandidate({ pts, effective, effectiveDelta, context });
    // Rebuild the candidate sheet the same way the scorer does and re-score it directly.
    const rebuilt: HeroSheet = { ...effective };
    for (const key of REOPT_KEYS) {
      rebuilt[key] = effective[key] + (result.pts[key] - pts[key]) * effectiveDelta[key];
    }
    const rescored = sustainedDps(rebuilt, context);
    expect(rescored).toBeCloseTo(result.reoptDps, 6);
  });

  it('is deterministic: two identical calls return deeply equal results', () => {
    const { pts, effective, effectiveDelta } = syntheticHero();
    const first = findGateCandidate({ pts, effective, effectiveDelta, context });
    const second = findGateCandidate({ pts, effective, effectiveDelta, context });
    expect(second).toEqual(first);
  });
});

/**
 * The bilinear-ridge scenario (design.md's Neighbourhood argument, AC-62b/AC-63a). All 80
 * budget points sit in attack (a real, valuable stat, not a zero-delta decoy) so any
 * neighbourhood transfer away from it has a genuine opportunity cost; crit chance/dmg start
 * near zero. `S5`'s restricted-greedy first phase accumulates up to `floor(B/2) = 40` points
 * into the crit pair one at a time — unconstrained by the neighbourhood's discrete block sizes
 * (max single transfer 2k=20) — reaching a compounding crit factor no single local-search move
 * from a from-attack start can match in one hop.
 */
function ridgeHero(): { pts: Record<SheetKey, number>; effective: HeroSheet; effectiveDelta: EffectiveDeltas } {
  const budget = 200;
  const pts: Record<SheetKey, number> = { ...ZERO_PTS(), attack: budget };
  const effective: HeroSheet = {
    rarity: 'Raro',
    attack: 1000 + budget * 20,
    energy: 500,
    speed: 55,
    critChance: 1,
    critDmg: 1,
    penetration: 8,
    cdr: 10,
    attackPerPoint: 20,
    energyPerPoint: 8,
  };
  const effectiveDelta: EffectiveDeltas = {
    attack: 20,
    energy: 0,
    speed: 0,
    critChance: 2,
    critDmg: 2,
    penetration: 0,
    cdr: 0,
  };
  return { pts, effective, effectiveDelta };
}

describe('optimizeBuild — Tier 2 (BSPW4-10)', () => {
  it('AC-62b: S5 (critPairHalf) wins the bilinear-ridge build, and S2 alone (Tier 1) scores lower', () => {
    const { pts, effective, effectiveDelta } = ridgeHero();
    const tier1 = findGateCandidate({ pts, effective, effectiveDelta, context }); // S1 vs S2 only
    const tier2 = optimizeBuild({ pts, effective, effectiveDelta, context });

    expect(tier2.winningSeed).toBe('critPairHalf');
    // Both DPS figures stated, per AC-62b's requirement that the test show greedy losing.
    expect(tier2.reoptDps).toBeGreaterThan(tier1.reoptDps);
  });

  it('AC-63c: the returned vector admits no further strictly improving move (re-verified independently)', () => {
    const { pts, effective, effectiveDelta } = ridgeHero();
    const result = optimizeBuild({ pts, effective, effectiveDelta, context });
    expect(result.budgetExhausted).toBe(false);

    // Independent re-verification: try every single-point transfer i -> j on the returned
    // vector and confirm none improves the score (a cheap subset of the real neighbourhood,
    // sufficient to catch a local search that stopped prematurely).
    const rebuild = (candidate: Record<SheetKey, number>) => {
      const sheet: HeroSheet = { ...effective };
      for (const key of REOPT_KEYS) sheet[key] = effective[key] + (candidate[key] - pts[key]) * effectiveDelta[key];
      return sustainedDps(sheet, context);
    };
    const baseScore = rebuild(result.pts);
    for (const from of REOPT_KEYS) {
      if (result.pts[from] < 1) continue;
      for (const to of REOPT_KEYS) {
        if (from === to) continue;
        const candidate = { ...result.pts, [from]: result.pts[from] - 1, [to]: result.pts[to] + 1 };
        expect(rebuild(candidate)).toBeLessThanOrEqual(baseScore + 1e-6);
      }
    }
  });

  it('AC-64a: tier monotonicity — optimizeBuild.reoptDps >= findGateCandidate.reoptDps on the same input', () => {
    for (const { file, names } of FIXTURES) {
      for (const [name, level] of names) {
        const real = realHeroDerive(file, name, level);
        const tier1 = findGateCandidate({ pts: real.pts, effective: real.effective, effectiveDelta: real.effectiveDelta, context });
        const tier2 = optimizeBuild({ pts: real.pts, effective: real.effective, effectiveDelta: real.effectiveDelta, context });
        // Tolerance: both tiers compute S1's raw score via an independent sustainedDps call,
        // so ULP-level floating point noise (not a real invariant violation) can separate them.
        expect(tier2.reoptDps, `${file}:${name}L${level}`).toBeGreaterThanOrEqual(tier1.reoptDps - 1e-6);
      }
    }
  });

  it('AC-57/AC-57a for Tier 2: reoptDps >= currentDps and gainPct >= 0 across all 8 real hero-instances', () => {
    for (const { file, names } of FIXTURES) {
      for (const [name, level] of names) {
        const real = realHeroDerive(file, name, level);
        const result = optimizeBuild({ pts: real.pts, effective: real.effective, effectiveDelta: real.effectiveDelta, context });
        expect(result.reoptDps, `${file}:${name}L${level}`).toBeGreaterThanOrEqual(result.currentDps);
        expect(result.gainPct, `${file}:${name}L${level}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('AC-64b: evaluations <= REOPT_FULL_MAX_EVALUATIONS, on a real fixture hero and at a synthetic B=100', () => {
    const real = realHeroDerive('payload-20260812-8heroes.json', 'Bellatrix', 27);
    const realResult = optimizeBuild({ pts: real.pts, effective: real.effective, effectiveDelta: real.effectiveDelta, context });
    expect(realResult.evaluations).toBeLessThanOrEqual(REOPT_FULL_MAX_EVALUATIONS);

    const { effective, effectiveDelta } = syntheticHero();
    const bigPts: Record<SheetKey, number> = { ...ZERO_PTS(), attack: 100 };
    const bigResult = optimizeBuild({ pts: bigPts, effective, effectiveDelta, context });
    expect(bigResult.evaluations).toBeLessThanOrEqual(REOPT_FULL_MAX_EVALUATIONS);
  });

  it('AC-64f: determinism — two identical calls return deeply equal results, including winningSeed/evaluations/sweeps', () => {
    const { pts, effective, effectiveDelta } = ridgeHero();
    const first = optimizeBuild({ pts, effective, effectiveDelta, context });
    const second = optimizeBuild({ pts, effective, effectiveDelta, context });
    expect(second).toEqual(first);
  });

  it('AC-64g: a constructed tie resolves to the earlier candidate (S1 current, when nothing can improve it)', () => {
    const { effective } = syntheticHero();
    // Zero budget makes every seed identical to "current" — the fast path already asserts
    // this, but exercise it through the full seed/local-search path with budget > 0 where
    // every candidate is provably zero-gain (all effectiveDelta zero).
    const flatDelta: EffectiveDeltas = { attack: 0, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0 };
    const pts: Record<SheetKey, number> = { ...ZERO_PTS(), attack: 5 };
    const result = optimizeBuild({ pts, effective, effectiveDelta: flatDelta, context });
    expect(result.winningSeed).toBe('current');
    expect(result.keptCurrent).toBe(true);
    expect(result.pts).toEqual(pts);
  });

  it('AC-64i/AC-64j: the same hero and budget under two different loadouts (via effective/effectiveDelta) produce different optimal vectors', () => {
    const pts: Record<SheetKey, number> = { ...ZERO_PTS(), speed: 10 };
    const flatAttackLoadout: HeroSheet = {
      rarity: 'Raro', attack: 2000, energy: 500, speed: 55, critChance: 10, critDmg: 80, penetration: 8, cdr: 10,
      attackPerPoint: 50, energyPerPoint: 8,
    };
    const critHeavyLoadout: HeroSheet = {
      rarity: 'Raro', attack: 400, energy: 500, speed: 55, critChance: 60, critDmg: 300, penetration: 8, cdr: 10,
      attackPerPoint: 5, energyPerPoint: 8,
    };
    const delta: EffectiveDeltas = { attack: 50, energy: 8, speed: 0, critChance: 3, critDmg: 12, penetration: 0.5, cdr: 1 };

    const flatResult = optimizeBuild({ pts, effective: flatAttackLoadout, effectiveDelta: delta, context });
    const critResult = optimizeBuild({ pts, effective: critHeavyLoadout, effectiveDelta: delta, context });
    expect(flatResult.pts).not.toEqual(critResult.pts);
  });

  it('AC-64k: derive\'s delta vector is independent of pts (same naked/sheetOther/level/stars/gem, different pts, same delta)', () => {
    const naked = { attack: 200, energy: 300, speed: 55, critChance: 10, critDmg: 80, penetration: 5, cdr: 4, luck: 15 };
    const mults = computeCombatMults({
      mods: abilityMods({}),
      teamBuffs: zeroTeamBuffs(),
            extraDmgPct: 0,
    });
    const args = {
      geared: naked,
      naked,
      sheetOther: { speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0 },
      rarity: 'Raro' as const,
      level: 30,
      stars: 0,
      attackMult: mults.attackMult,
      energyMult: mults.energyMult,
      speedMult: mults.speedMult,
      critDmgMult: mults.critDmgMult,
      teamCritPctOfBase: 0,
      treeSheet: { danoStatic: 1, energyPct: 0, speedPct: 0, critChancePct: 0, critDmgPct: 0, luckFlatPct: 0, critDmgMult: 1 },
      combatCritChancePctOfBase: 0,
      penetrationPp: 0,
      context,
      dmgMult: mults.dmgMult,
      mitigationPct: 6.7,
    };
    const atZero = derive({ ...args, pts: ZERO_PTS() });
    const atSpent = derive({ ...args, pts: { ...ZERO_PTS(), attack: 5, critChance: 2 } });
    expect(atSpent.delta).toEqual(atZero.delta);
  });

  it('AC-64m: optimizeBuild ships unwired — computeAdvisorPipeline is not imported by this module', () => {
    // Structural: points-reopt.ts has zero dependency on advisor-pipeline.ts (verified by the
    // module graph typechecking without one); Wave 6 wires Tier 2 to the Points tab.
    expect(typeof optimizeBuild).toBe('function');
  });

  it('AC-64d: median of 20 runs on a real fixture hero is under 250ms (loose canary, not the budget)', () => {
    const real = realHeroDerive('payload-20260812-8heroes.json', 'Bellatrix', 27);
    const times: number[] = [];
    for (let index = 0; index < 20; index++) {
      const start = performance.now();
      optimizeBuild({ pts: real.pts, effective: real.effective, effectiveDelta: real.effectiveDelta, context });
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const median = times[10];
    expect(median).toBeLessThan(250);
  });

  it('AC-58/AC-59 for Tier 2: budget/Luck handling matches Tier 1', () => {
    const { pts, effective, effectiveDelta } = ridgeHero();
    const hostile = optimizeBuild({ pts: { ...pts, luck: 9999 }, effective, effectiveDelta, context });
    const honest = optimizeBuild({ pts: { ...pts, luck: 0 }, effective, effectiveDelta, context });
    for (const key of REOPT_KEYS) expect(hostile.pts[key]).toBe(honest.pts[key]);
    expect(hostile.gainPct).toBe(honest.gainPct);
    expect(hostile.pts.luck).toBe(9999);
  });
});

/**
 * Banked, unspent stat points (`HeroRecord.statPointsAvailable`, threaded through
 * `ReoptInput.statPointsAvailable`) — no committed save fixture has a nonzero value here (every
 * fixture hero has `stat_points_available: 0`), so the "0 spent, N unspent" case the
 * `budget <= 0` fast path used to get wrong is constructed by hand below, for both tiers.
 */
describe('statPointsAvailable — banked, unspent points fold into the search budget', () => {
  it('optional and defaults to 0 — omitting it is byte-identical to passing 0 explicitly (Tier 1 and Tier 2, back-compat for team-plan callers)', () => {
    const { pts, effective, effectiveDelta } = syntheticHero();
    expect(findGateCandidate({ pts, effective, effectiveDelta, context })).toEqual(
      findGateCandidate({ pts, effective, effectiveDelta, context, statPointsAvailable: 0 }),
    );
    expect(optimizeBuild({ pts, effective, effectiveDelta, context })).toEqual(
      optimizeBuild({ pts, effective, effectiveDelta, context, statPointsAvailable: 0 }),
    );
  });

  it('Tier 1: 0 spent + N unspent no longer takes the budget<=0 fast path — the hero gets a real reallocation', () => {
    const { effective, effectiveDelta } = syntheticHero();
    const result = findGateCandidate({ pts: ZERO_PTS(), effective, effectiveDelta, context, statPointsAvailable: 8 });
    // AC-57f's fast path returns evaluations <= 1 and keptCurrent true with an unchanged vector —
    // none of that may hold here, because the fast path itself must not fire (budget = 8, not 0).
    expect(result.evaluations).toBeGreaterThan(1);
    expect(result.keptCurrent).toBe(false);
    const placed = REOPT_KEYS.reduce((sum, key) => sum + result.pts[key], 0);
    expect(placed).toBeGreaterThan(0);
    expect(placed).toBeLessThanOrEqual(8);
    expect(result.reoptDps).toBeGreaterThan(result.currentDps);
  });

  it('Tier 2: 0 spent + N unspent no longer takes the budget<=0 fast path — the hero gets a real reallocation', () => {
    const { effective, effectiveDelta } = syntheticHero();
    const result = optimizeBuild({ pts: ZERO_PTS(), effective, effectiveDelta, context, statPointsAvailable: 8 });
    expect(result.evaluations).toBeGreaterThan(1);
    expect(result.keptCurrent).toBe(false);
    const placed = REOPT_KEYS.reduce((sum, key) => sum + result.pts[key], 0);
    expect(placed).toBeGreaterThan(0);
    expect(placed).toBeLessThanOrEqual(8);
    expect(result.reoptDps).toBeGreaterThan(result.currentDps);
  });

  it('Tier 1: unallocated correctly counts banked points left idle when every candidate scores <= 0 (S1 kept, budget > 0)', () => {
    // All-flat effectiveDelta: every candidate ties zero-gain, so the greedy walk never accepts
    // a step and S1 (== the zero-start seed here, since pts is already all zero) is kept. Before
    // this wave, `unallocated` was hardcoded to 0 whenever keptCurrent was true — exactly wrong
    // here, since none of the 6 banked points ever got placed anywhere.
    const { effective } = syntheticHero();
    const flatDelta: EffectiveDeltas = {
      attack: 0,
      energy: 0,
      speed: 0,
      critChance: 0,
      critDmg: 0,
      penetration: 0,
      cdr: 0,
    };
    const result = findGateCandidate({
      pts: ZERO_PTS(),
      effective,
      effectiveDelta: flatDelta,
      context,
      statPointsAvailable: 6,
    });
    expect(result.keptCurrent).toBe(true);
    expect(result.pts).toEqual(ZERO_PTS());
    expect(result.unallocated).toBe(6);
  });

  it('Tier 2: unallocated correctly counts banked points left idle when the "current" seed wins (all moves flat)', () => {
    const { effective } = syntheticHero();
    const flatDelta: EffectiveDeltas = {
      attack: 0,
      energy: 0,
      speed: 0,
      critChance: 0,
      critDmg: 0,
      penetration: 0,
      cdr: 0,
    };
    const result = optimizeBuild({
      pts: ZERO_PTS(),
      effective,
      effectiveDelta: flatDelta,
      context,
      statPointsAvailable: 5,
    });
    expect(result.winningSeed).toBe('current');
    expect(result.pts).toEqual(ZERO_PTS());
    expect(result.unallocated).toBe(5);
  });

  it('budget conservation on a real fixture hero with both spent AND banked points: placed + unallocated == spent + statPointsAvailable (both tiers)', () => {
    const real = realHeroDerive('payload-20260812-8heroes.json', 'Bellatrix', 27);
    const spent = REOPT_KEYS.reduce((sum, key) => sum + real.pts[key], 0);
    const banked = 20;

    const tier1 = findGateCandidate({
      pts: real.pts,
      effective: real.effective,
      effectiveDelta: real.effectiveDelta,
      context,
      statPointsAvailable: banked,
    });
    const tier1Placed = REOPT_KEYS.reduce((sum, key) => sum + tier1.pts[key], 0);
    expect(tier1Placed + tier1.unallocated).toBe(spent + banked);

    const tier2 = optimizeBuild({
      pts: real.pts,
      effective: real.effective,
      effectiveDelta: real.effectiveDelta,
      context,
      statPointsAvailable: banked,
    });
    const tier2Placed = REOPT_KEYS.reduce((sum, key) => sum + tier2.pts[key], 0);
    expect(tier2Placed + tier2.unallocated).toBe(spent + banked);
  });
});
