import { describe, expect, it } from 'vitest';
import { abilityMods, levelPowerMult, mitigationFactor, type Context } from '@bombfarm/domain/model';
import { emptySheetOther, starsMult, type SheetOtherPct, type SheetStats } from '@bombfarm/domain/gear';
import { computeCombatMults, derive } from '@bombfarm/domain/derive';
import type { TreeSheetTotals } from '@bombfarm/domain/birth-sheet';
import { ZERO_PTS, SHEET_DISPLAY_KEYS, type SheetKey } from '@bombfarm/domain/planner-constants';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import {
  BREAKDOWN_DERIVED_IDS,
  buildStatBreakdown,
  foldLedger,
  LEDGER_SOURCE_GROUP,
  type LedgerSource,
  type PipelineFacts,
  type StatBreakdown,
} from '@bombfarm/domain/stat-breakdown';

const TOL = 0.05;

const baseCtx = (): Context => ({
  restSeconds: 12 * 60,
  mitigation: 0.067,
  blastRange: 1,
  cycleModel: 'serial',
  walkDelay: 0.15,
  drainMult: 1,
});

const sampleNaked = (): SheetStats => ({
  attack: 200,
  energy: 400,
  speed: 55,
  critChance: 10,
  critDmg: 80,
  penetration: 5,
  cdr: 4,
  luck: 15,
});

function otherFactor(percent: number): number {
  return 1 + Math.max(0, percent);
}

/** Bake sheet-ability factors into a ★0 sample (matches defaultNaked order). */
function bakeSheetOtherIntoNaked(n: SheetStats, o: SheetOtherPct): SheetStats {
  return {
    ...n,
    speed: n.speed * otherFactor(o.speed),
    // Flat addends, not pool factors (POINT_GAIN.critChanceFlat / .critDmgFlat / .cdrFlat).
    critChance: n.critChance + Math.max(0, o.critChanceFlat),
    critDmg: n.critDmg + Math.max(0, o.critDmgFlat),
    penetration: n.penetration * otherFactor(o.penetration),
    cdr: n.cdr + Math.max(0, o.cdrFlat),
  };
}

function bakeStarsIntoNaked(n: SheetStats, stars: number): SheetStats {
  const S = starsMult(stars);
  if (Math.abs(S - 1) < 1e-12) return n;
  return {
    ...n,
    attack: n.attack * S,
    energy: n.energy * S,
    critChance: n.critChance * S,
    critDmg: n.critDmg * S,
    penetration: n.penetration * S,
    cdr: n.cdr * S,
  };
}

type FixtureOpts = {
  pts?: Record<SheetKey, number>;
  abilities?: Record<string, number>;
  teamBuffs?: ReturnType<typeof zeroTeamBuffs> & Record<string, number>;
  treeEnergy?: number;
  treeSpeed?: number;
  treeCritChance?: number;
  treeCritDmg?: number;
  treeLuckFlatPct?: number;
  treeDanoTotal?: number;
  extraDmgPct?: number;
  rest?: number;
  level?: number;
  stars?: number;
  /** When set, overrides sheetOther derived from ability mods. */
  sheetOther?: SheetOtherPct;
  naked?: SheetStats;
  geared?: SheetStats;
};

function buildFixture(opts: FixtureOpts = {}) {
  const level = opts.level ?? 30;
  const stars = opts.stars ?? 0;
  const mods = abilityMods(opts.abilities ?? {});
  const sheetOther =
    opts.sheetOther ??
    ({
      ...emptySheetOther(),
      critChanceFlat: mods.sheetCritChanceFlat,
      penetration: mods.sheetPenetrationRaw,
      critDmgFlat: mods.sheetCritDmgFlat,
    } satisfies SheetOtherPct);

  const naked =
    opts.naked ??
    bakeStarsIntoNaked(bakeSheetOtherIntoNaked(sampleNaked(), sheetOther), stars);
  const pts = opts.pts ?? ZERO_PTS();
  const teamBuffs = { ...zeroTeamBuffs(), ...(opts.teamBuffs ?? {}) };
  const treeEnergy = opts.treeEnergy ?? 0;
  const treeSpeed = opts.treeSpeed ?? 0;
  const treeCritChance = opts.treeCritChance ?? 0;
  const treeCritDmg = opts.treeCritDmg ?? 0;
  const treeLuckFlatPct = opts.treeLuckFlatPct ?? 0;
  const treeDanoTotal = opts.treeDanoTotal ?? 1;
  const extraDmgPct = opts.extraDmgPct ?? 0;

  // BSPW4-06 (AC-40/41): the real imported sheet is ALWAYS tree-inclusive (the skill tree is
  // applied exactly once, in the sheet — BSP-23c). A default `geared` that ignores treeXxx
  // would make `derive`'s single-application `effective` disagree with a ledger that (rightly)
  // shows a 'tree' step — bake the SAME single application into the default fixture so the two
  // stay consistent, matching what a real save's `stats` block already does.
  //
  // MP5 removed all five keystones (Glass Cannon / Tempo Dobrado included); their sheet-math
  // corrections no longer exist anywhere in the pipeline, so this fixture builder no longer
  // takes or applies them — `computeCombatMults.energyMult/critDmgMult` are permanent identity,
  // and `speedMult` never carried Tempo. Matches `applySkillTree` exactly (birth-sheet.ts).
  function poolBump(value: number, otherPct: number, treePct: number): number {
    return value + (treePct / 100) * (value / (1 + otherPct));
  }
  const geared =
    opts.geared ??
    ({
      ...naked,
      attack: (naked.attack + 50) * treeDanoTotal,
      energy: (naked.energy + 40) * (1 + treeEnergy / 100),
      speed: poolBump(naked.speed, sheetOther.speed, treeSpeed),
      critChance: naked.critChance + Math.max(0, sheetOther.critChanceFlat) + treeCritChance,
      critDmg: poolBump(naked.critDmg - Math.max(0, sheetOther.critDmgFlat), 0, treeCritDmg)
        + Math.max(0, sheetOther.critDmgFlat),
    } satisfies SheetStats);

  const treeSheet: TreeSheetTotals = {
    danoStatic: treeDanoTotal,
    energyPct: treeEnergy,
    speedPct: treeSpeed,
    critChancePct: treeCritChance,
    critDmgPct: treeCritDmg,
    luckFlatPct: treeLuckFlatPct,
  };

  const mults = computeCombatMults({
    mods,
    teamBuffs,
    extraDmgPct,
  });

  const rest = opts.rest ?? 12 * 60;
  const context: Context = {
    ...baseCtx(),
    restSeconds: rest,
    drainMult: mods.drainMult * mults.teamDrainMult,
  };

  const deriveResult = derive({
    geared,
    naked,
    sheetOther,
    pts,
    rarity: 'Raro',
    level,
    stars,
    attackMult: mults.attackMult,
    energyMult: mults.energyMult,
    speedMult: mults.speedMult,
    critDmgMult: mults.critDmgMult,
    teamCritChanceFlat: mults.teamCritChanceFlat,
    treeSheet,
    combatCritChanceFlat: mods.combatCritChanceFlat,
    penetrationPp: mods.penetrationPp,
    context,
    dmgMult: mults.dmgMult,
    mitigationPct: 6.7,
  });

  const field = deriveResult.effective.energy / context.drainMult;
  const uptime = (100 * field) / (field + rest);

  const facts: PipelineFacts = {
    geared,
    adjusted: deriveResult.adjusted,
    pts,
    delta: deriveResult.delta,
    effective: deriveResult.effective,
    mods,
    sheetOther,
    naked,
    level,
    stars,
    attackMult: mults.attackMult,
    energyMult: mults.energyMult,
    speedMult: mults.speedMult,
    critDmgMult: mults.critDmgMult,
    teamCritChanceFlat: mults.teamCritChanceFlat,
    treeSpeed,
    treeCritChance,
    treeCritDmg,
    treeEnergy,
    treeLuckFlatPct,
    context,
    dmgMult: mults.dmgMult,
    treeDanoTotal,
    extraDmgPct,
    active: deriveResult.active,
    dps: deriveResult.dps,
    uptime,
    rest,
  };

  return { facts, deriveResult };
}

function assertLedgersRecompose(facts: PipelineFacts): void {
  for (const k of SHEET_DISPLAY_KEYS) {
    const bd = buildStatBreakdown(k, facts);
    expect(bd.kind).toBe('ledger');
    if (bd.kind !== 'ledger') return;
    const folded = foldLedger(bd.steps);
    expect(Math.abs(folded - facts.effective[k]), `${k} fold=${folded} eff=${facts.effective[k]}`).toBeLessThan(
      TOL,
    );
    expect(Math.abs(bd.total - facts.effective[k])).toBeLessThan(TOL);
  }
}

function assertFormulasMatch(facts: PipelineFacts): void {
  for (const id of BREAKDOWN_DERIVED_IDS) {
    const bd = buildStatBreakdown(id, facts);
    expect(bd.kind).toBe('formula');
    if (bd.kind !== 'formula') return;
    const hit =
      facts.effective.attack *
      mitigationFactor(facts.context.mitigation, facts.effective.penetration) *
      facts.dmgMult;
    const pipelineValue =
      id === 'mitF'
        ? mitigationFactor(facts.context.mitigation, facts.effective.penetration)
        : id === 'dmg'
          ? facts.dmgMult
          : id === 'hit'
            ? hit
            : id === 'criticalHit'
              ? hit * (1 + facts.effective.critDmg / 100)
              : id === 'critFactor'
                ? 1 + (facts.effective.critChance / 100) * (facts.effective.critDmg / 100)
                : id === 'fuse'
                  ? Math.max(2 * (1 - facts.effective.cdr / 100), 0.4)
                  : id === 'bombsPerSecond'
                    ? 1 / (Math.max(2 * (1 - facts.effective.cdr / 100), 0.4) + facts.context.walkDelay)
                    : id === 'fieldSeconds'
                      ? facts.effective.energy / facts.context.drainMult
                      : id === 'rest'
                        ? facts.rest / 60
                        : id === 'uptime'
                          ? facts.uptime
                          : id === 'activeDps'
                            ? facts.active
                            : facts.dps;
    expect(bd.value).toBeCloseTo(pipelineValue, 6);
  }
}

describe('stat-breakdown builder', () => {
  it('F1 — buffs off / zeroed points: birth + level + gear', () => {
    const { facts } = buildFixture({ pts: ZERO_PTS() });
    assertLedgersRecompose(facts);
    assertFormulasMatch(facts);
    const atk = buildStatBreakdown('attack', facts);
    expect(atk.kind).toBe('ledger');
    if (atk.kind === 'ledger') {
      expect(atk.steps.map((s) => s.source)).toEqual(['base', 'level', 'gear']);
      expect(atk.steps[0]?.amount).toBeCloseTo(facts.naked.attack / levelPowerMult(30), 6);
      expect(atk.steps[1]?.amount).toBeCloseTo(levelPowerMult(30), 6);
      expect(atk.steps[2]?.amount).toBeCloseTo(50, 6);
      expect(atk.steps[2]?.pctOfBase).toBeUndefined();
    }
  });

  it('F2 — general buffs on: all step kinds present; ledgers recompose', () => {
    const { facts } = buildFixture({
      pts: { ...ZERO_PTS(), attack: 3, energy: 2, speed: 1, critChance: 1, critDmg: 1, penetration: 1, cdr: 1 },
      abilities: { grito_guerra: 5, marcha_acelerada: 5, olho_clinico: 5 },
      teamBuffs: { ...zeroTeamBuffs(), grito_guerra: 10, pressagio_mortal: 5 },
      treeEnergy: 10,
      treeSpeed: 8,
      treeCritChance: 5,
      treeCritDmg: 10,
    });
    assertLedgersRecompose(facts);
    assertFormulasMatch(facts);
    const atk = buildStatBreakdown('attack', facts);
    if (atk.kind === 'ledger') {
      expect(atk.steps.some((s) => s.source === 'points')).toBe(true);
      expect(atk.steps.some((s) => s.source === 'abilitiesTeam')).toBe(true);
    }
  });

  it('F4b — shared-pool gear shows percent × base', () => {
    const naked = sampleNaked();
    const geared = { ...naked, speed: naked.speed + naked.speed * 0.02 };
    const { facts } = buildFixture({ naked, geared, pts: ZERO_PTS() });
    assertLedgersRecompose(facts);
    const speed = buildStatBreakdown('speed', facts);
    expect(speed.kind).toBe('ledger');
    if (speed.kind === 'ledger') {
      const gear = speed.steps.find((s) => s.source === 'gear');
      expect(gear?.pctOfBase?.percent).toBeCloseTo(2, 5);
      expect(gear?.pctOfBase?.base).toBeCloseTo(naked.speed, 6);
      expect(gear?.amount).toBeCloseTo(naked.speed * 0.02, 6);
    }
  });

  it('F5 — uncapped team: ownTeamSplit note', () => {
    // Own Grito 10 (+10%, W3 perLevel 1) + team Grito 20 → attackMult 1.3
    const { facts } = buildFixture({
      abilities: { grito_guerra: 10 },
      teamBuffs: { ...zeroTeamBuffs(), grito_guerra: 20 },
    });
    expect(facts.attackMult).toBeCloseTo(1.3, 6);
    assertLedgersRecompose(facts);
    const atk = buildStatBreakdown('attack', facts);
    expect(atk.kind).toBe('ledger');
    if (atk.kind === 'ledger') {
      const step = atk.steps.find((s) => s.source === 'abilitiesTeam');
      expect(step?.note).toBe('ownTeamSplit');
      expect(step?.splitOwn).toBeCloseTo(10, 5);
      expect(step?.splitTeam).toBeCloseTo(20, 5);
    }
  });

  it('F6 — capped team: capped note; still recomposes', () => {
    const { facts } = buildFixture({
      abilities: { grito_guerra: 10 },
      teamBuffs: { ...zeroTeamBuffs(), grito_guerra: 100 },
    });
    expect(facts.attackMult).toBe(2);
    assertLedgersRecompose(facts);
    const atk = buildStatBreakdown('attack', facts);
    expect(atk.kind).toBe('ledger');
    if (atk.kind === 'ledger') {
      const step = atk.steps.find((s) => s.source === 'abilitiesTeam');
      expect(step?.note).toBe('capped');
      expect(step?.amount).toBe(2);
    }
  });

  it('F7 — zeroed points with buffs: Points step omitted', () => {
    const { facts } = buildFixture({
      pts: ZERO_PTS(),
      abilities: { grito_guerra: 10 },
      teamBuffs: { ...zeroTeamBuffs(), grito_guerra: 10 },
      treeSpeed: 5,
      treeEnergy: 5,
    });
    assertLedgersRecompose(facts);
    assertFormulasMatch(facts);
    const atk = buildStatBreakdown('attack', facts);
    if (atk.kind === 'ledger') {
      expect(atk.steps.some((s) => s.source === 'points')).toBe(false);
      expect(atk.steps.some((s) => s.source === 'abilitiesTeam')).toBe(true);
    }
  });

  it('F8 — peels birth → level → stars → Keen Eye / Diamond Tip', () => {
    const level = 26;
    const stars = 2;
    const { facts } = buildFixture({
      level,
      stars,
      abilities: { olho_clinico: 10, ponta_diamante: 10 },
    });
    assertLedgersRecompose(facts);
    assertFormulasMatch(facts);

    const atk = buildStatBreakdown('attack', facts);
    expect(atk.kind).toBe('ledger');
    if (atk.kind === 'ledger') {
      expect(atk.steps.map((s) => s.source)).toEqual(['base', 'level', 'stars', 'gear']);
      expect(atk.steps[0]?.amount).toBeCloseTo(
        facts.naked.attack / (levelPowerMult(level) * starsMult(stars)),
        6,
      );
    }

    const crit = buildStatBreakdown('critChance', facts);
    expect(crit.kind).toBe('ledger');
    if (crit.kind === 'ledger') {
      // 'gear' now appears because the crit-chance gear term is a flat ADD rather than a
      // percent-of-base step, and the fixture's geared sheet carries one.
      expect(crit.steps.map((s) => s.source)).toEqual(['base', 'stars', 'sheetAbilities', 'gear']);
      const sheet = crit.steps.find((s) => s.source === 'sheetAbilities');
      expect(sheet?.note).toBe('keenEye');
      expect(sheet?.op).toBe('+');
      // olho_clinico @10 is a FLAT addend since the 2026-08-15 patch: 10 x 0.04574 pp.
      expect(sheet?.amount).toBeCloseTo(0.4574, 6);
    }

    const pen = buildStatBreakdown('penetration', facts);
    expect(pen.kind).toBe('ledger');
    if (pen.kind === 'ledger') {
      const sheet = pen.steps.find((s) => s.source === 'sheetAbilities');
      expect(sheet?.note).toBe('diamondTip');
      // ponta_diamante @10, W3 perLevel 1.0 -> raw Σ 10 (was 20 pre-W3).
      expect(sheet?.amount).toBeCloseTo(11, 6);
    }
  });

  it('peels birth → stars → Brutal Strike (Golpe Brutal) as a flat crit-dmg addend, noted brutalStrike', () => {
    const level = 26;
    const stars = 2;
    const { facts } = buildFixture({
      level,
      stars,
      abilities: { golpe_brutal: 10 },
    });
    assertLedgersRecompose(facts);
    assertFormulasMatch(facts);

    const cd = buildStatBreakdown('critDmg', facts);
    expect(cd.kind).toBe('ledger');
    if (cd.kind === 'ledger') {
      expect(cd.steps.map((s) => s.source)).toEqual(['base', 'stars', 'sheetAbilities']);
      const sheet = cd.steps.find((s) => s.source === 'sheetAbilities');
      expect(sheet?.note).toBe('brutalStrike');
      // golpe_brutal @10, perLevel 4 -> flat +40 planner pp, unscaled by ★ (POINT_GAIN.critDmgFlat).
      expect(sheet?.op).toBe('+');
      expect(sheet?.amount).toBeCloseTo(40, 6);
    }
  });

  it('F9 — attack tree step is × dmg_static on the Hero+Gear+Ability subtotal (AC-42)', () => {
    const { facts } = buildFixture({
      pts: { ...ZERO_PTS(), attack: 2 },
      treeDanoTotal: 1.2,
    });
    assertLedgersRecompose(facts);
    const atk = buildStatBreakdown('attack', facts);
    expect(atk.kind).toBe('ledger');
    if (atk.kind === 'ledger') {
      expect(atk.steps.map((s) => s.source)).toEqual(['base', 'level', 'gear', 'tree', 'points']);
      const gear = atk.steps.find((s) => s.source === 'gear');
      // Pure gear (50), sourced BEFORE the tree multiplication — not 50 × 1.2.
      expect(gear?.op).toBe('+');
      expect(gear?.amount).toBeCloseTo(50, 6);
      const tree = atk.steps.find((s) => s.source === 'tree');
      expect(tree?.op).toBe('×');
      expect(tree?.amount).toBeCloseTo(1.2, 6);
      // formulaDmg no longer contains treeDanoTotal (AC-42).
      const dmg = buildStatBreakdown('dmg', facts);
      expect(dmg.kind).toBe('formula');
      if (dmg.kind === 'formula') {
        expect(dmg.substituted).not.toContain('1.2');
      }
    }
  });

  it('F10 — critChance / critDmg tree steps are additive-pool, sourced before combat mults (AC-41)', () => {
    const { facts } = buildFixture({
      pts: { ...ZERO_PTS(), critChance: 1, critDmg: 1 },
      treeCritChance: 6,
      treeCritDmg: 12,
    });
    assertLedgersRecompose(facts);
    const crit = buildStatBreakdown('critChance', facts);
    expect(crit.kind).toBe('ledger');
    if (crit.kind === 'ledger') {
      const tree = crit.steps.find((s) => s.source === 'tree' && s.op === '+');
      // Flat since the 2026-08-15 patch — the tree crit-chance step carries no pctOfBase.
      expect(tree?.pctOfBase).toBeUndefined();
      const treeIndex = crit.steps.findIndex((s) => s.source === 'tree');
      const combatIndex = crit.steps.findIndex((s) => s.source === 'abilities' || s.source === 'team');
      expect(treeIndex).toBeGreaterThanOrEqual(0);
      if (combatIndex >= 0) expect(treeIndex).toBeLessThan(combatIndex);
    }
    const critDmg = buildStatBreakdown('critDmg', facts);
    expect(critDmg.kind).toBe('ledger');
    if (critDmg.kind === 'ledger') {
      const tree = critDmg.steps.find((s) => s.source === 'tree' && s.op === '+');
      expect(tree?.pctOfBase?.percent).toBeCloseTo(12, 6);
      expect(tree?.pctOfBase?.base).toBeCloseTo(facts.naked.critDmg - Math.max(0, facts.sheetOther.critDmgFlat), 6);
    }
  });

  it('mutation-kill: perturbing a ledger amount breaks recompose', () => {
    const { facts } = buildFixture({
      pts: { ...ZERO_PTS(), attack: 2 },
      abilities: { grito_guerra: 10 },
    });
    const bd = buildStatBreakdown('attack', facts);
    expect(bd.kind).toBe('ledger');
    if (bd.kind !== 'ledger') return;
    const mutated: StatBreakdown = {
      kind: 'ledger',
      total: bd.total,
      steps: bd.steps.map((s, i) => (i === bd.steps.length - 1 ? { ...s, amount: s.amount + 0.5 } : s)),
    };
    expect(Math.abs(foldLedger(mutated.steps) - facts.effective.attack)).toBeGreaterThanOrEqual(TOL);
  });
});

describe('LEDGER_SOURCE_GROUP is exhaustive over LedgerSource (BSP-20, AC-28, DEC-07)', () => {
  const ALL_SOURCES: LedgerSource[] = [
    'base',
    'level',
    'stars',
    'sheetAbilities',
    'gear',
    'points',
    'tree',
    'abilities',
    'team',
    'abilitiesTeam',
  ];

  it('every LedgerSource union member has a mapped LedgerGroup', () => {
    for (const source of ALL_SOURCES) {
      expect(LEDGER_SOURCE_GROUP[source]).toBeDefined();
    }
    expect(Object.keys(LEDGER_SOURCE_GROUP).sort()).toEqual([...ALL_SOURCES].sort());
  });

  it('base / level / stars / points map to hero; gear to gear; sheetAbilities to ability; tree to skillTree', () => {
    expect(LEDGER_SOURCE_GROUP.base).toBe('hero');
    expect(LEDGER_SOURCE_GROUP.level).toBe('hero');
    expect(LEDGER_SOURCE_GROUP.stars).toBe('hero');
    expect(LEDGER_SOURCE_GROUP.points).toBe('hero');
    expect(LEDGER_SOURCE_GROUP.gear).toBe('gear');
    expect(LEDGER_SOURCE_GROUP.sheetAbilities).toBe('ability');
    expect(LEDGER_SOURCE_GROUP.tree).toBe('skillTree');
  });

  it('abilities / team / abilitiesTeam map to combat — below the sheet, not a game line', () => {
    expect(LEDGER_SOURCE_GROUP.abilities).toBe('combat');
    expect(LEDGER_SOURCE_GROUP.team).toBe('combat');
    expect(LEDGER_SOURCE_GROUP.abilitiesTeam).toBe('combat');
  });
});

describe('ledgerLuck (BSP-44, AC-22, DEC-06)', () => {
  it('Hero / Gear / Ability(0) / Points / Skill tree lines recompose to adjusted.luck within 0.01', () => {
    const naked = sampleNaked();
    const pts = { ...ZERO_PTS(), luck: 4 };
    const treeLuckFlatPct = 2.5;
    const gearLuckPct = 0.12;
    const geared: SheetStats = {
      ...naked,
      luck: naked.luck * (1 + gearLuckPct) + treeLuckFlatPct,
    };
    const { facts } = buildFixture({ naked, geared, pts, treeLuckFlatPct, sheetOther: emptySheetOther() });

    const bd = buildStatBreakdown('luck', facts);
    expect(bd.kind).toBe('ledger');
    if (bd.kind !== 'ledger') return;

    expect(Math.abs(foldLedger(bd.steps) - facts.adjusted.luck)).toBeLessThan(0.01);
    expect(Math.abs(bd.total - facts.adjusted.luck)).toBeLessThan(0.01);

    const sources = bd.steps.map((s) => s.source);
    expect(sources).toContain('base');
    expect(sources).toContain('gear');
    expect(sources).toContain('sheetAbilities');
    expect(sources).toContain('points');
    expect(sources).toContain('tree');

    const abilityStep = bd.steps.find((s) => s.source === 'sheetAbilities');
    expect(abilityStep?.amount).toBe(0);

    const baseStep = bd.steps.find((s) => s.source === 'base');
    expect(baseStep?.amount).toBeCloseTo(naked.luck, 6);
  });

  it('recomposes to adjusted.luck in the degenerate case (no gear, no points, no tree)', () => {
    const { facts } = buildFixture({ sheetOther: emptySheetOther() });
    const bd = buildStatBreakdown('luck', facts);
    expect(bd.kind).toBe('ledger');
    if (bd.kind !== 'ledger') return;
    expect(Math.abs(foldLedger(bd.steps) - facts.adjusted.luck)).toBeLessThan(0.01);
  });

  it('the Ability(0) line is present even with no gear/tree/points contribution', () => {
    const { facts } = buildFixture({ sheetOther: emptySheetOther() });
    const bd = buildStatBreakdown('luck', facts);
    expect(bd.kind).toBe('ledger');
    if (bd.kind !== 'ledger') return;
    const abilityStep = bd.steps.find((s) => s.source === 'sheetAbilities');
    expect(abilityStep).toBeDefined();
    expect(abilityStep?.amount).toBe(0);
  });
});
