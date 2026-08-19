import { describe, expect, it } from 'vitest';
import { abilityMods, predictHitDamage, sustainedDps, type Context } from '@bombfarm/domain/model';
import { emptySheet, emptySheetOther, type SheetStats } from '@bombfarm/domain/gear';
import { computeCombatMults, combineTeamAuraPct, derive, type DeriveInput } from '@bombfarm/domain/derive';
import type { TreeSheetTotals } from '@bombfarm/domain/birth-sheet';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import {
  TEAM_BUFF_ABILITY_IDS,
  TEAM_BUFF_CAP,
  TEAM_BUFF_PER_LEVEL,
  zeroTeamBuffs,
  type TeamBuffId,
} from '@bombfarm/domain/team-buffs';
import { extractHero, loadFixtureJson, treeTotalsFromSave } from './helpers/sheet-math-fixtures';

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

/** No skill tree — every application site in `derive` becomes a pure identity factor. */
const ZERO_TREE: TreeSheetTotals = {
  danoStatic: 1,
  energyPct: 0,
  speedPct: 0,
  critChancePct: 0,
  critDmgPct: 0,
  luckFlatPct: 0,
  critDmgMult: 1,
};

describe('computeCombatMults', () => {
  it('the ComputeCombatMultsInput type no longer accepts a tree damage/energy term (AC-29)', () => {
    // Compile-time guard: `treeDanoTotal` / `treeEnergy` must be gone from the type, not
    // merely unused. This assigns a value of the exact input shape `computeCombatMults`
    // accepts; adding either field back would fail `pnpm typecheck`, not this assertion.
    const mods = abilityMods({});
    const input: Parameters<typeof computeCombatMults>[0] = {
      mods,
      teamBuffs: zeroTeamBuffs(),
      extraDmgPct: 0,
    };
    expect('treeDanoTotal' in input).toBe(false);
    expect('treeEnergy' in input).toBe(false);
  });

  it('stacks own Grito + other heroes’ Grito additively, not multiplicatively', () => {
    // RETIRED (issue #132): this test used to pin a real math-check screenshot (Brenna grito
    // +20% own, Dara grito +20% team → ×1.4, not ×1.44; predictHitDamage ≈5404/9522). That
    // screenshot predates the confirmed per-ability cap (Fault 4) — the maintainer's own
    // roster shows two carriers clamp at ONE carrier's maximum, and Grito's confirmed cap is
    // 20 (rank 20 × 1%/level), well under the 40% the screenshot's own+team combo totals. The
    // screenshot numbers are therefore no longer a reachable state under the confirmed rule,
    // so the hit-damage pins are gone; the shape they proved (additive, not squared) is kept
    // below with a combo that stays under the cap.
    const mods = abilityMods({});
    mods.attackMult = 1.1; // own +10%
    const m = computeCombatMults({
      mods,
      teamBuffs: { ...zeroTeamBuffs(), grito_guerra: 5 }, // team +5%
      extraDmgPct: 0,
    });
    expect(mods.attackMult).toBeCloseTo(1.1, 6);
    expect(m.attackMult).toBeCloseTo(1.15, 6);
    expect(m.attackMult).not.toBeCloseTo(1.1 * 1.05, 6);
  });

  it('caps combined team attack bonus at the ability’s own maximum (Fault 4)', () => {
    expect(combineTeamAuraPct(80, 40, TEAM_BUFF_CAP.grito_guerra)).toBeCloseTo(
      TEAM_BUFF_CAP.grito_guerra,
      6,
    );
    const mods = abilityMods({ grito_guerra: 10 }); // +10% (current perLevel 1)
    const m = computeCombatMults({
      mods,
      teamBuffs: { ...zeroTeamBuffs(), grito_guerra: 100 },
      extraDmgPct: 0,
    });
    // Own 10% + others 100% would be 110% under the old global +100% cap; the real cap is
    // Grito's own maximum (20%), not a shared global figure.
    expect(m.attackMult).toBeCloseTo(1 + TEAM_BUFF_CAP.grito_guerra / 100, 6);
  });

  it('returns identity-ish mults with empty buffs and default tree', () => {
    const mods = abilityMods({});
    const m = computeCombatMults({
      mods,
      teamBuffs: zeroTeamBuffs(),
      extraDmgPct: 0,
    });
    expect(m.attackMult).toBe(1);
    expect(m.speedMult).toBe(1);
    expect(m.energyMult).toBe(1);
    expect(m.critDmgMult).toBe(1);
    expect(m.dmgMult).toBe(1);
    expect(m.teamDrainMult).toBe(1);
  });
});

describe('team aura faults (issue #132)', () => {
  it('Fault 2/4: a carrier’s own rank is not double counted against the roster total — capped, not squared', () => {
    // Jon carries folego_mineiro 20 himself; Doran ALSO carries folego_mineiro 20.
    // computeTeamBuffsFromDeployed(heroes, 'jon') excludes Jon, so it hands back Doran's 20
    // alone as "others". The old code multiplied mods.drainMult (which had folded Jon's own
    // 20 in already) by teamDrainMult (Doran's 20 again) — 0.80 x 0.80 = 0.64. The confirmed
    // rule caps the COMBINED total (own 20 + others 20 = 40) at Fôlego's own maximum (20),
    // giving 0.80, not 0.64.
    const jonMods = abilityMods({ folego_mineiro: 20 });
    const m = computeCombatMults({
      mods: jonMods,
      teamBuffs: { ...zeroTeamBuffs(), folego_mineiro: 20 }, // Doran's contribution alone
      extraDmgPct: 0,
    });
    expect(m.teamDrainMult).toBeCloseTo(0.8, 6);
    expect(m.teamDrainMult).not.toBeCloseTo(0.64, 6);
  });

  it('Fault 4: two rank-10 carriers give the same combined total as one rank-20 carrier', () => {
    const perLevel = TEAM_BUFF_PER_LEVEL.folego_mineiro;
    const oneRank20 = combineTeamAuraPct(0, perLevel * 20, TEAM_BUFF_CAP.folego_mineiro);
    const twoRank10 = combineTeamAuraPct(perLevel * 10, perLevel * 10, TEAM_BUFF_CAP.folego_mineiro);
    expect(twoRank10).toBeCloseTo(oneRank20, 10);
    expect(twoRank10).toBe(TEAM_BUFF_CAP.folego_mineiro);
  });

  it('Fault 1: Contra o Relógio is a self ability, not a team aura — no team stacking, no TeamBuffId key', () => {
    expect(TEAM_BUFF_ABILITY_IDS).not.toContain('contra_relogio');
    const mods = abilityMods({ contra_relogio: 20 }); // +40% own (2%/level)
    const m = computeCombatMults({
      mods,
      // A loose Record<string, number> (e.g. from an old persisted save) can still carry an
      // orphaned contra_relogio key — it must read as harmlessly absent, never stacked.
      teamBuffs: { ...zeroTeamBuffs(), contra_relogio: 999 } as Record<TeamBuffId, number>,
      extraDmgPct: 0,
    });
    expect(m.gateAttackMult).toBeCloseTo(1.4, 6);
  });
});

describe('derive', () => {
  it('applies simulated points and combat mults to produce effective sheet', () => {
    const naked = sampleNaked();
    const geared = { ...naked, attack: naked.attack + 50 };
    const pts = { ...ZERO_PTS(), attack: 2, energy: 1 };
    const mults = computeCombatMults({
      mods: abilityMods({}),
      teamBuffs: zeroTeamBuffs(),
      extraDmgPct: 0,
    });

    const result = derive({
      geared,
      naked,
      sheetOther: emptySheetOther(),
      pts,
      rarity: 'Raro',
      level: 1,
      stars: 0,
      attackMult: mults.attackMult,
      energyMult: mults.energyMult,
      speedMult: mults.speedMult,
      critDmgMult: mults.critDmgMult,
      teamCritPctOfBase: mults.teamCritPctOfBase,
      treeSheet: ZERO_TREE,
      combatCritChancePctOfBase: 0,
      penetrationPp: 0,
      context: baseCtx(),
      dmgMult: mults.dmgMult,
      mitigationPct: 6.7,
    });

    expect(result.delta.attack).toBe(10);
    expect(result.adjusted.attack).toBeCloseTo(geared.attack + 20, 6);
    expect(result.effective.attack).toBeCloseTo(result.adjusted.attack, 6);
    expect(result.dps).toBeGreaterThan(0);
    expect(result.active).toBeGreaterThan(0);
    expect(result.hit).toBeGreaterThan(0);
  });

  it('carries a finite luck delta/effectiveDelta/adjusted, but never on effective (BSPW2-AC-13)', () => {
    const naked = sampleNaked();
    const geared = { ...naked, attack: naked.attack + 50 };
    const pts = { ...ZERO_PTS(), luck: 4 };
    const mults = computeCombatMults({
      mods: abilityMods({}),
      teamBuffs: zeroTeamBuffs(),
      extraDmgPct: 0,
    });

    const result = derive({
      geared,
      naked,
      sheetOther: emptySheetOther(),
      pts,
      rarity: 'Raro',
      level: 1,
      stars: 0,
      attackMult: mults.attackMult,
      energyMult: mults.energyMult,
      speedMult: mults.speedMult,
      critDmgMult: mults.critDmgMult,
      teamCritPctOfBase: mults.teamCritPctOfBase,
      treeSheet: ZERO_TREE,
      combatCritChancePctOfBase: 0,
      penetrationPp: 0,
      context: baseCtx(),
      dmgMult: mults.dmgMult,
      mitigationPct: 6.7,
    });

    expect(Number.isFinite(result.delta.luck)).toBe(true);
    expect(Number.isFinite(result.effectiveDelta.luck)).toBe(true);
    expect(Number.isFinite(result.adjusted.luck)).toBe(true);
    expect(result.adjusted.luck).toBeCloseTo(geared.luck + pts.luck * result.delta.luck, 6);
    expect('luck' in result.effective).toBe(false);
  });

  it('scales energy point delta by geared/naked energy ratio', () => {
    const naked = sampleNaked();
    const geared = { ...naked, energy: naked.energy * 1.5 };
    const result = derive({
      geared,
      naked,
      sheetOther: emptySheetOther(),
      pts: ZERO_PTS(),
      rarity: 'Épico',
      level: 1,
      stars: 0,
      attackMult: 1,
      energyMult: 1,
      speedMult: 1,
      critDmgMult: 1,
      teamCritPctOfBase: 0,
      treeSheet: ZERO_TREE,
      combatCritChancePctOfBase: 0,
      penetrationPp: 0,
      context: baseCtx(),
      dmgMult: 1,
      mitigationPct: 0,
    });
    expect(result.delta.energy).toBeCloseTo(8 * 1.5, 6);
  });

  it('is stable for empty sheets', () => {
    const naked = emptySheet();
    const result = derive({
      geared: emptySheet(),
      naked,
      sheetOther: emptySheetOther(),
      pts: ZERO_PTS(),
      rarity: 'Comum',
      level: 1,
      stars: 0,
      attackMult: 1,
      energyMult: 1,
      speedMult: 1,
      critDmgMult: 1,
      teamCritPctOfBase: 0,
      treeSheet: ZERO_TREE,
      combatCritChancePctOfBase: 0,
      penetrationPp: 0,
      context: baseCtx(),
      dmgMult: 1,
      mitigationPct: 0,
    });
    expect(result.delta.energy).toBe(8); // gem falls back to 1 when naked.energy is 0
    expect(Number.isFinite(result.dps)).toBe(true);
  });

  it('AC-30/AC-31: effective ≡ the real save sheet at pts=0 — the tree is applied exactly once (BSP-22)', () => {
    // The load-bearing double-count regression guard (M1/M2 in spec.md's discrimination note).
    // MP5 F1 (AD-068 class (a) + (b)): re-pointed onto save-20260813-5heroes.json's Bellatrix
    // (8/8 geared) — the only post-patch corpus hero pattern available. RECORDED LOSS: every
    // post-patch capture has `crit_dmg_add: 0` (skills.totals), so this can no longer
    // discriminate a crit-damage-specific double-count the way the deleted crit-dmg-tree
    // fixture could (its `critDmgPct` was nonzero); the `critChance`/`energy`/`speed`/`attack`
    // axes below still discriminate (their tree percentages are nonzero on this hero). See
    // docs/fixture-corpus.md for the loss record.
    const raw = loadFixtureJson('save-20260813-5heroes.json');
    const bellatrix = extractHero(raw, 'Bellatrix', 42);
    const totals = (raw.skills as { totals: Record<string, unknown> }).totals;
    const treeSheet = treeTotalsFromSave(totals);
    expect(treeSheet.danoStatic).toBeCloseTo(1.2094754277978, 9);
    expect(treeSheet.critDmgPct).toBe(0);

    // geared = the real, tree-inclusive save sheet; pts = 0 — so `adjusted === geared`
    // regardless of `naked`, and with every combat mult at identity, `effective` can only
    // equal `geared` if the tree is applied ZERO more times on top of it.
    const mults = computeCombatMults({
      mods: abilityMods({}),
      teamBuffs: zeroTeamBuffs(),
      extraDmgPct: 0,
    });
    expect(mults.attackMult).toBe(1);
    expect(mults.speedMult).toBe(1);
    expect(mults.energyMult).toBe(1);
    expect(mults.critDmgMult).toBe(1);
    expect(mults.dmgMult).toBe(1);

    const result = derive({
      geared: bellatrix.sheet,
      naked: bellatrix.sheet,
      sheetOther: emptySheetOther(),
      pts: ZERO_PTS(),
      rarity: bellatrix.rarity,
      level: bellatrix.level,
      stars: bellatrix.stars,
      attackMult: mults.attackMult,
      energyMult: mults.energyMult,
      speedMult: mults.speedMult,
      critDmgMult: mults.critDmgMult,
      teamCritPctOfBase: 0,
      treeSheet,
      combatCritChancePctOfBase: 0,
      penetrationPp: 0,
      context: baseCtx(),
      dmgMult: mults.dmgMult,
      mitigationPct: 6.7,
    });

    // AC-30: five formerly-doubled stats derive to the game's own displayed sheet, exactly.
    for (const key of ['speed', 'critChance', 'critDmg', 'energy'] as const) {
      expect(result.effective[key], key).toBeCloseTo(bellatrix.sheet[key], 6);
    }
    expect(result.effective.attack).toBeCloseTo(bellatrix.sheet.attack, 6);

    // AC-31: hit reproduces predictHitDamage from `effective` alone — no dmg_static anywhere
    // in the expression (dmgMult is 1 here, so a correct hit is the raw predicted hit).
    const expectedHit = predictHitDamage(
      result.effective.attack,
      6.7 / 100,
      result.effective.penetration,
      mults.dmgMult,
    );
    expect(result.hit).toBeCloseTo(expectedHit, 6);
  });

  it('AC-32: dps for save-20260813’s Bellatrix drops by exactly dmg_static vs the old double-counting form', () => {
    // MP5 F1 (AD-068 class (a)): re-pointed onto save-20260813-5heroes.json's Bellatrix.
    const raw = loadFixtureJson('save-20260813-5heroes.json');
    const bellatrix = extractHero(raw, 'Bellatrix', 42);
    const totals = (raw.skills as { totals: Record<string, unknown> }).totals;
    const treeSheet = treeTotalsFromSave(totals);
    const danoStatic = 1.2094754277978;
    expect(treeSheet.danoStatic).toBeCloseTo(danoStatic, 9);

    const mults = computeCombatMults({
      mods: abilityMods({}),
      teamBuffs: zeroTeamBuffs(),
      extraDmgPct: 0,
    });

    const deriveArgs = {
      geared: bellatrix.sheet,
      naked: bellatrix.sheet,
      sheetOther: emptySheetOther(),
      pts: ZERO_PTS(),
      rarity: bellatrix.rarity,
      level: bellatrix.level,
      stars: bellatrix.stars,
      attackMult: mults.attackMult,
      energyMult: mults.energyMult,
      speedMult: mults.speedMult,
      critDmgMult: mults.critDmgMult,
      teamCritPctOfBase: 0,
      treeSheet,
      combatCritChancePctOfBase: 0,
      penetrationPp: 0,
      context: baseCtx(),
      mitigationPct: 6.7,
    } as const;

    const fixed = derive({ ...deriveArgs, dmgMult: mults.dmgMult });

    // Pin `fixed.dps` directly to an INDEPENDENT computation (`sustainedDps` called directly,
    // not through a second `derive()`), so a uniform internal double-count inside `derive`
    // itself cannot cancel out of a same-function-pair ratio the way M1 would if both sides
    // of a comparison routed back through `derive`.
    const correctDps = sustainedDps(fixed.effective, deriveArgs.context) * mults.dmgMult;
    expect(fixed.dps).toBeCloseTo(correctDps, 6);

    // M1, simulated directly: the pre-wave bug re-multiplied `dmgMult` (hence `dps`/`hit`) by
    // `danoStatic` on top of the already tree-inclusive sheet. Reproduce that exact "old code"
    // value from the SAME independent `sustainedDps` call, not from a second `derive()` pass.
    const doubleCountedDps = sustainedDps(fixed.effective, deriveArgs.context) * mults.dmgMult * danoStatic;
    expect(doubleCountedDps / fixed.dps).toBeCloseTo(danoStatic, 9);
    expect(fixed.dps).toBeCloseTo(doubleCountedDps / danoStatic, 6);
  });

  it('AC-33: delta.attack scales by treeSheet.danoStatic (the sheet the delta is added to is post-dmg_static)', () => {
    const naked = sampleNaked();
    const tree: TreeSheetTotals = { ...ZERO_TREE, danoStatic: 1.78324567735483 };
    const result = derive({
      geared: naked,
      naked,
      sheetOther: emptySheetOther(),
      pts: ZERO_PTS(),
      rarity: 'Raro',
      level: 10,
      stars: 1,
      attackMult: 1,
      energyMult: 1,
      speedMult: 1,
      critDmgMult: 1,
      teamCritPctOfBase: 0,
      treeSheet: tree,
      combatCritChancePctOfBase: 0,
      penetrationPp: 0,
      context: baseCtx(),
      dmgMult: 1,
      mitigationPct: 0,
    });
    // attackPointGain(10) × starsMult(1) × danoStatic = (10 × (1+0.04×9)) × 1.5 × 1.78324567735483
    const expected = 10 * (1 + 0.04 * 9) * 1.5 * 1.78324567735483;
    expect(result.delta.attack).toBeCloseTo(expected, 9);
  });

  it('AC-34/BSPW5-11 (DISC-01): delta.energy needs NO explicit tree factor — gem already carries energia_add once naked is tree-free', () => {
    // Rebuilt for Wave 5 (was a pre-tree `geared` shape — `{...naked, energy: naked.energy
    // * 1.2}` — that cannot occur once import is birth-backed; MOD-03/L-05: the INPUT
    // changes, the assertion rigour does not). `naked` here already stands in for
    // `nakedFromBirth`'s genuinely tree-free output; `geared` must therefore be
    // TREE-INCLUSIVE (post gear AND post skill tree, exactly what `applySkillTree`
    // produces) — the only shape `derive` receives once import is birth-backed.
    const naked = sampleNaked();
    const gearMult = 1.2;
    const energyPct = 81.2711865;
    const geared = { ...naked, energy: naked.energy * gearMult * (1 + energyPct / 100) };
    const tree: TreeSheetTotals = { ...ZERO_TREE, energyPct };
    const result = derive({
      geared,
      naked,
      sheetOther: emptySheetOther(),
      pts: ZERO_PTS(),
      rarity: 'Raro',
      level: 1,
      stars: 2,
      attackMult: 1,
      energyMult: 1,
      speedMult: 1,
      critDmgMult: 1,
      teamCritPctOfBase: 0,
      treeSheet: tree,
      combatCritChancePctOfBase: 0,
      penetrationPp: 0,
      context: baseCtx(),
      dmgMult: 1,
      mitigationPct: 0,
    });
    // Independent literal computation (not re-derived from the code under test): gem is
    // exactly gearMult * (1 + energyPct/100) by construction of `geared` above.
    const gem = gearMult * (1 + energyPct / 100);
    const star = 1 + 0.5 * 2;
    const expected = 8 * gem * star;
    expect(result.delta.energy).toBeCloseTo(expected, 9);

    // M1 discrimination companion: the pre-wave bug re-multiplied by (1 + energyPct/100)
    // a second time on top of `gem` (which, for a tree-inclusive `geared`, already carries
    // it once) — prove the fixed result is NOT that 1.81x-overstated value.
    const doubleCountedEnergyPct = 8 * (geared.energy / naked.energy) * star * (1 + energyPct / 100);
    expect(result.delta.energy).not.toBeCloseTo(doubleCountedEnergyPct, 0);
    expect(doubleCountedEnergyPct / result.delta.energy).toBeCloseTo(1 + energyPct / 100, 6);
  });

  it('AC-37/AC-39: pooled deltas (speed/critChance/critDmg/pen/cdr/luck) are unchanged from main — no tree divisor', () => {
    // Explicit literals, computed independently of the implementation, so this proves the
    // wave's neutrality claim on the GAP-W4-01 axis rather than merely restating the source.
    const naked = sampleNaked();
    const tree: TreeSheetTotals = {
      danoStatic: 2,
      energyPct: 50,
      speedPct: 30,
      critChancePct: 40,
      critDmgPct: 20,
      luckFlatPct: 5,
      critDmgMult: 1,
    };
    const result = derive({
      geared: naked,
      naked,
      sheetOther: emptySheetOther(),
      pts: ZERO_PTS(),
      rarity: 'Raro',
      level: 1,
      stars: 0,
      attackMult: 1,
      energyMult: 1,
      speedMult: 1,
      critDmgMult: 1,
      teamCritPctOfBase: 0,
      treeSheet: tree,
      combatCritChancePctOfBase: 0,
      penetrationPp: 0,
      context: baseCtx(),
      dmgMult: 1,
      mitigationPct: 0,
    });
    // These literals match the pre-wave formula `POINT_GAIN.xPctOfBase * naked.x / (1 + O)`
    // with O = 0 (emptySheetOther) — no tree factor participates, regardless of how large
    // `tree` above is set, proving no tree divisor leaked into the pooled deltas.
    expect(result.delta.speed).toBeCloseTo(0.02 * naked.speed, 9);
    expect(result.delta.critChance).toBeCloseTo(0.02 * naked.critChance, 9);
    // Crit damage is flat (POINT_GAIN.critDmgFlat) — `naked.critDmg` deliberately absent.
    expect(result.delta.critDmg).toBeCloseTo(5, 9);
    expect(result.delta.penetration).toBeCloseTo(0.02 * naked.penetration, 9);
    expect(result.delta.cdr).toBeCloseTo(0.02 * naked.cdr, 9);
    expect(result.delta.luck).toBeCloseTo(0.03 * naked.luck, 9);
  });

  it('the DeriveInput type no longer accepts the four scattered tree fields (AC-29)', () => {
    const input: DeriveInput = {
      geared: sampleNaked(),
      naked: sampleNaked(),
      sheetOther: emptySheetOther(),
      pts: ZERO_PTS(),
      rarity: 'Comum',
      level: 1,
      stars: 0,
      attackMult: 1,
      energyMult: 1,
      speedMult: 1,
      critDmgMult: 1,
      teamCritPctOfBase: 0,
      treeSheet: ZERO_TREE,
      combatCritChancePctOfBase: 0,
      penetrationPp: 0,
      context: baseCtx(),
      dmgMult: 1,
      mitigationPct: 0,
    };
    expect('treeSpeed' in input).toBe(false);
    expect('treeCritChance' in input).toBe(false);
    expect('treeCritDmg' in input).toBe(false);
    expect('treeDanoTotal' in input).toBe(false);
    expect('treeSheet' in input).toBe(true);
  });
});
