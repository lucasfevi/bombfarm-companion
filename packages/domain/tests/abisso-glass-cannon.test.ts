import { describe, expect, it } from 'vitest';
import { computeCombatMults } from '../src/derive';
import { effectiveTreeSheetForAbisso, type TreeSheetTotals } from '../src/birth-sheet';
import { abilityMods } from '../src/model';
import { zeroTeamBuffs } from '../src/team-buffs';
import { parseSaveFile } from '../src/import-save';
import { unmodelledTreeFindings } from '../src/tree-guards';

const ZERO_TREE: TreeSheetTotals = {
  danoStatic: 1,
  energyPct: 0,
  speedPct: 0,
  critChancePct: 12,
  critDmgPct: 8,
  luckFlatPct: 0,
  critDmgMult: 1,
};

describe('Abisso × Glass Cannon combat gate', () => {
  it('Glass Cannon alone applies energy ×0.5 and crit dmg ×2', () => {
    const m = computeCombatMults({
      mods: abilityMods({}),
      teamBuffs: zeroTeamBuffs(),
      treeGlassCannon: true,
      treeTempoDobrado: false,
      treeAbisso: false,
      extraDmgPct: 0,
    });
    expect(m.energyMult).toBe(0.5);
    expect(m.critDmgMult).toBe(2);
  });

  it('Abisso + Glass Cannon keeps energy ×0.5 and suppresses crit ×2', () => {
    const m = computeCombatMults({
      mods: abilityMods({}),
      teamBuffs: zeroTeamBuffs(),
      treeGlassCannon: true,
      treeTempoDobrado: false,
      treeAbisso: true,
      extraDmgPct: 0,
    });
    expect(m.energyMult).toBe(0.5);
    expect(m.critDmgMult).toBe(1);
  });

  it('Abisso alone applies neither Glass Cannon mult', () => {
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
});
