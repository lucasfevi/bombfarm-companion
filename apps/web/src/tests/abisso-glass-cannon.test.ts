import { describe, expect, it } from 'vitest';
import { unmodelledTreeFindings } from '@bombfarm/domain/tree-guards';
import { computeCombatMults } from '@bombfarm/domain/derive';
import {
  applySkillTree,
  effectiveTreeSheetForAbisso,
  nakedFromBirth,
  type BirthStats,
  type TreeSheetTotals,
} from '@bombfarm/domain/birth-sheet';
import { abilityMods } from '@bombfarm/domain/model';
import { emptySheetOther } from '@bombfarm/domain/gear';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { parseSaveFile } from '@bombfarm/domain/import-save';

const ZERO_TREE: TreeSheetTotals = {
  danoStatic: 1,
  energyPct: 0,
  speedPct: 0,
  critChancePct: 12,
  critDmgPct: 8,
  luckFlatPct: 0,
  critDmgMult: 1,
};

describe('Abisso × Glass Cannon — computeCombatMults no longer applies either keystone', () => {
  // Post keystone sheet-math correction: Glass Cannon's energy ×0.5 / crit-damage ×2 and
  // Tempo Dobrado's speed ×1.33333 are all applied ONCE, at the sheet layer (applySkillTree
  // via TreeSheetTotals.glassCannon/.critDmgMult/.tempoDobrado) — never here, regardless of
  // the tree/Abisso flags. Applying them again in combat would double-count them.
  it('Glass Cannon alone: identity mults', () => {
    const m = computeCombatMults({
      mods: abilityMods({}),
      teamBuffs: zeroTeamBuffs(),
      treeGlassCannon: true,
      treeTempoDobrado: false,
      treeAbisso: false,
      extraDmgPct: 0,
    });
    expect(m.energyMult).toBe(1);
    expect(m.critDmgMult).toBe(1);
  });

  it('Abisso + Glass Cannon: still identity mults', () => {
    const m = computeCombatMults({
      mods: abilityMods({}),
      teamBuffs: zeroTeamBuffs(),
      treeGlassCannon: true,
      treeTempoDobrado: false,
      treeAbisso: true,
      extraDmgPct: 0,
    });
    expect(m.energyMult).toBe(1);
    expect(m.critDmgMult).toBe(1);
  });

  it('Abisso alone: identity mults', () => {
    const m = computeCombatMults({
      mods: abilityMods({}),
      teamBuffs: zeroTeamBuffs(),
      treeGlassCannon: false,
      treeTempoDobrado: false,
      treeAbisso: true,
      extraDmgPct: 0,
    });
    expect(m.energyMult).toBe(1);
    expect(m.critDmgMult).toBe(1);
  });

  it('effectiveTreeSheetForAbisso zeroes Crit tree adds for what-if', () => {
    const gated = effectiveTreeSheetForAbisso(ZERO_TREE, true);
    expect(gated.critChancePct).toBe(0);
    expect(gated.critDmgPct).toBe(0);
    expect(gated.danoStatic).toBe(1);
    expect(effectiveTreeSheetForAbisso(ZERO_TREE, false)).toEqual(ZERO_TREE);
  });

  it('Abisso does NOT gate critDmgMult — applySkillTree keeps Glass Cannon\'s ×2 live under Abisso', () => {
    // effectiveTreeSheetForAbisso zeroes critChancePct/critDmgPct (the exporter really does
    // zero those) but must NOT touch critDmgMult — the verified save has both D15 and C15, and
    // the ×2 is plainly present in the exported sheet regardless.
    const birth: BirthStats = {
      attack: 100, energy: 200, speed: 50, critChance: 8, critDmg: 60, penetration: 3, cdr: 2, luck: 5,
    };
    const sheetOther = emptySheetOther();
    const naked = nakedFromBirth(birth, 1, 0, sheetOther);
    const rawTree: TreeSheetTotals = { ...ZERO_TREE, critChancePct: 12, critDmgPct: 8, critDmgMult: 2 };
    const gatedTree = effectiveTreeSheetForAbisso(rawTree, true);
    expect(gatedTree.critDmgMult).toBe(2);
    const composed = applySkillTree(naked, naked, sheetOther, gatedTree);
    // base × (critDmgMult − 1), base = naked.critDmg here (empty sheetOther).
    expect(composed.critDmg).toBeCloseTo(naked.critDmg + naked.critDmg * (2 - 1), 9);
  });
});

describe('Abisso import sniff (2026-08-08 save shape)', () => {
  it('maps abisso + glassCannon from stale crit_dmg_mult and zeroed crit adds', () => {
    const save = {
      export_version: 1,
      heroes: [],
      skills: {
        totals: {
          abisso_base: 1.008,
          coin_add: 0,
          crit_chance_add: 0,
          crit_dmg_add: 0,
          crit_dmg_mult: 2,
          dmg_static: 557.558647429325,
          energia_add: 1.45,
          geo_mult: 1,
          keystones: ['D15', 'C15', 'O15', 'S15', 'G07'],
          luck_add: 0.3,
          speed_add: 0.1,
          team_dmg_add: 1.7,
          xp_mult: 0.78,
        },
      },
    };
    const { account, warnings } = parseSaveFile(save, []);
    expect(account.tree).toMatchObject({
      abisso: true,
      glassCannon: true,
      critChance: 0,
      critDmg: 0,
    });
    expect(warnings.some((w) => w.includes('unknown'))).toBe(false);
    expect(warnings.some((w) => w.includes('BSP-61') || w.includes('DEC-08'))).toBe(false);
  });
});

describe('unmodelledTreeFindings (known keystones)', () => {
  it('known keystone ids and crit_dmg_mult !== 1 produce no findings', () => {
    expect(
      unmodelledTreeFindings({
        keystones: ['D15', 'C15', 'V15', 'O15', 'S15', 'G07'],
        crit_dmg_mult: 2,
      }),
    ).toEqual([]);
  });

  it('unknown keystone ids still surface a finding', () => {
    const findings = unmodelledTreeFindings({ keystones: ['deadly_eye'] });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('unknown');
    expect(findings[0]).toContain('deadly_eye');
  });

  it('empty keystones produce no findings', () => {
    expect(unmodelledTreeFindings({ keystones: [], crit_dmg_mult: 1 })).toEqual([]);
    expect(unmodelledTreeFindings({})).toEqual([]);
  });
});
