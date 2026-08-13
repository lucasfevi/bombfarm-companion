import { describe, expect, it } from 'vitest';
import { abilityMods, predictHitDamage, sustainedDps, type Context } from '@bombfarm/domain/model';
import { emptySheet, emptySheetOther, type SheetStats } from '@bombfarm/domain/gear';
import { computeCombatMults, derive, stackTeamBonusMult, TEAM_MULT_BONUS_CAP, type DeriveInput } from '@bombfarm/domain/derive';
import type { TreeSheetTotals } from '@bombfarm/domain/birth-sheet';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
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
  it('applies team buffs, tree toggles, and ability mods', () => {
    const mods = abilityMods({ grito_guerra: 0 });
    mods.attackMult = 1.1;
    mods.speedMult = 1.05;
    mods.gateAttackMult = 1.2;
    mods.dmgMult = 1.15;

    const teamBuffs = {
      ...zeroTeamBuffs(),
      grito_guerra: 10,
      marcha_acelerada: 5,
      folego_mineiro: 20,
      contra_relogio: 15,
      pressagio_mortal: 8,
    };

    const m = computeCombatMults({
      mods,
      teamBuffs,
      treeGlassCannon: true,
      treeTempoDobrado: true,
      extraDmgPct: 10,
    });

    // Own + others stack additively (not 1.1×1.1).
    expect(m.teamAtkMult).toBeCloseTo(1.1, 6);
    expect(m.teamSpeedMult).toBeCloseTo(1.05, 6);
    expect(m.teamDrainMult).toBeCloseTo(0.8, 6);
    expect(m.teamGateMult).toBeCloseTo(1.15, 6);
    expect(m.teamCritPctOfBase).toBe(8);
    expect(m.attackMult).toBeCloseTo(1.2, 6); // +10% own + +10% team
    // No more Tempo factor here (the keystone sheet-math correction moved Tempo Dobrado's
    // ×1.33333 to applySkillTree) — just +5% own + +5% team, same shape as attackMult.
    expect(m.speedMult).toBeCloseTo(1.1, 6);
    expect(m.gateAttackMult).toBeCloseTo(1.35, 6); // +20% own + +15% team
    // Glass Cannon's energy ×0.5 / crit-damage ×2 are ALSO gone from here (same correction) —
    // both are sheet-layer factors now (TreeSheetTotals.glassCannon / .critDmgMult, applied
    // once in applySkillTree), so this function returns identity regardless of the tree flags.
    expect(m.energyMult).toBe(1);
    expect(m.critDmgMult).toBe(1);
    // REWRITTEN (was `1.25 * 1.15 * 1.1` — the 1.25 was `treeDanoTotal`, which no longer
    // participates here; `dmg_static` now lives on the sheet only, applied once). `dmgMult`
    // is exactly `mods.dmgMult × (1 + extraDmgPct/100)`.
    expect(m.dmgMult).toBeCloseTo(1.15 * 1.1, 6);
  });

  it('the ComputeCombatMultsInput type no longer accepts a tree damage/energy term (AC-29)', () => {
    // Compile-time guard: `treeDanoTotal` / `treeEnergy` must be gone from the type, not
    // merely unused. This assigns a value of the exact input shape `computeCombatMults`
    // accepts; adding either field back would fail `pnpm typecheck`, not this assertion.
    const mods = abilityMods({});
    const input: Parameters<typeof computeCombatMults>[0] = {
      mods,
      teamBuffs: zeroTeamBuffs(),
      treeGlassCannon: false,
      treeTempoDobrado: false,
      extraDmgPct: 0,
    };
    expect('treeDanoTotal' in input).toBe(false);
    expect('treeEnergy' in input).toBe(false);
  });

  it('stacks own Grito + other heroes’ Grito additively (Brenna/Dara math-check)', () => {
    // Brenna grito 10 (+20%) + Dara on field grito 10 (+20%) → ×1.4, not ×1.44.
    // Clay-gloves sheet + imported tree/mit reproduce the Math check screenshot.
    // This screenshot predates the W3 (AD-BSP-18) 10->20 catalog rebalance (grito_guerra
    // was 2%/level then, 1%/level now) — override attackMult with the historical +20% own
    // contribution directly rather than deriving it from the live (post-rebalance) catalog,
    // so this test keeps proving computeCombatMults' additive stacking against the real
    // math-check numbers it was written against.
    //
    // ASM-07 / L-07 (DEC-01): this capture is PRE-TREE — `brenna-03-clay-luva.json`'s
    // `stats.dmg` (1934.60587600238) is the OLD exporter's raw, tree-free sheet value, not
    // the tree-inclusive sheet `save-20260801-crit-dmg-tree.json` produces. The local `tree`
    // literal below is applied ONCE, exactly as `AD-BSP-12` requires — do not re-derive this
    // number from the live (post-wave) model; that would convert a real observation into a
    // tautology (see `design.md`'s `DEC-01`).
    const mods = abilityMods({});
    mods.attackMult = 1.2;
    const m = computeCombatMults({
      mods,
      teamBuffs: { ...zeroTeamBuffs(), grito_guerra: 20 },
      treeGlassCannon: false,
      treeTempoDobrado: false,
      extraDmgPct: 0,
    });
    expect(mods.attackMult).toBeCloseTo(1.2, 6);
    expect(m.attackMult).toBeCloseTo(1.4, 6);
    expect(m.attackMult).not.toBeCloseTo(1.44, 6);

    const atk = 1934.6;
    const pen = 74.7;
    const mit = 0.058;
    const tree = 2.02493208666875;
    const pred = predictHitDamage(atk * m.attackMult, mit, pen, tree);
    expect(pred).toBeCloseTo(5404, 0);
    // Crit ratio matches sheet (+76.2%); observed crit 9521 ≈ pred × 1.762.
    expect(pred * (1 + 0.762)).toBeCloseTo(9522, 0);
  });

  it('caps combined team attack bonus at +100%', () => {
    expect(stackTeamBonusMult(1.8, 40)).toBeCloseTo(1 + TEAM_MULT_BONUS_CAP, 6);
    const mods = abilityMods({ grito_guerra: 10 }); // +20%
    const m = computeCombatMults({
      mods,
      teamBuffs: { ...zeroTeamBuffs(), grito_guerra: 100 },
      treeGlassCannon: false,
      treeTempoDobrado: false,
      extraDmgPct: 0,
    });
    expect(m.attackMult).toBe(2);
  });

  it('returns identity-ish mults with empty buffs and default tree', () => {
    const mods = abilityMods({});
    const m = computeCombatMults({
      mods,
      teamBuffs: zeroTeamBuffs(),
      treeGlassCannon: false,
      treeTempoDobrado: false,
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

describe('derive', () => {
  it('applies simulated points and combat mults to produce effective sheet', () => {
    const naked = sampleNaked();
    const geared = { ...naked, attack: naked.attack + 50 };
    const pts = { ...ZERO_PTS(), attack: 2, energy: 1 };
    const mults = computeCombatMults({
      mods: abilityMods({}),
      teamBuffs: zeroTeamBuffs(),
      treeGlassCannon: false,
      treeTempoDobrado: false,
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
      treeGlassCannon: false,
      treeTempoDobrado: false,
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
      treeGlassCannon: false,
      treeTempoDobrado: false,
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
      treeGlassCannon: false,
      treeTempoDobrado: false,
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
    expect(result.delta.critDmg).toBeCloseTo(0.08 * naked.critDmg, 9);
    expect(result.delta.penetration).toBeCloseTo(0.02 * naked.penetration, 9);
    expect(result.delta.cdr).toBeCloseTo(0.1 * naked.cdr, 9);
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
