import { describe, expect, it } from 'vitest';
import { applySkillTree, composeSheetFromBirth, type TreeSheetTotals } from '@bombfarm/domain/birth-sheet';
import {
  NO_COLLECTION,
  applyCollection,
  collectionFromSave,
  collectionGoldMult,
  collectionKey,
  collectionLuckPct,
  normalizeCollection,
  stripCollection,
  type CollectionSheetPct,
} from '@bombfarm/domain/collection';
import { inferSpentPoints } from '@bombfarm/domain/point-inference';
import { peelSheetSources } from '@bombfarm/domain/sheet-peel';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { emptySheetOther } from '@bombfarm/domain/gear';
import { goldRarityMult, wikiPhaseLine } from '@bombfarm/domain/phase-wiki';
import { saveSheetUnits } from '@bombfarm/domain/save-units';
import { totalsWithNode } from '@bombfarm/domain/skill-tree/totals';
import { SKILL_TREE } from '@bombfarm/domain/skill-tree/catalog';
import type { SkillTotals } from '@bombfarm/domain/skill-tree/state';
import { extractHero, loadFixtureJson, treeTotalsFromSave } from './helpers/sheet-math-fixtures';

const SHEET_COLLECTION: CollectionSheetPct = { energyPct: 13.03, critChancePct: 4.8, critDmgPct: 0.22, cdrPct: 0.71 };

describe('collectionFromSave', () => {
  it('reads every axis of skills.totals.colecao as a percentage', () => {
    const collection = collectionFromSave({
      colecao: { dano: 4.5, critd: 0.22, critc: 4.8, recarga: 0.71, energia: 13.03, ouro: 10.31, xp: 11.32, sorte: 1.02, jaula: 0, forja: 0 },
    });
    expect(collection).toEqual({
      damagePct: 4.5,
      critDmgPct: 0.22,
      critChancePct: 4.8,
      cdrPct: 0.71,
      cagePct: 0,
      energyPct: 13.03,
      goldPct: 10.31,
      xpPct: 11.32,
      luckPct: 1.02,
      forgePct: 0,
    });
  });

  it('reads a save from before Collections existed, and a malformed axis, as no bonus', () => {
    expect(collectionFromSave({ xp_mult: 1.5 })).toEqual(NO_COLLECTION);
    expect(collectionFromSave({ colecao: { dano: 'x', energia: Number.NaN } })).toEqual(NO_COLLECTION);
  });

  it('round-trips through storage, and anything that is not an object is no record', () => {
    const collection = collectionFromSave({ colecao: { energia: 13.03, ouro: 10.31 } });
    expect(normalizeCollection(JSON.parse(JSON.stringify(collection)))).toEqual(collection);
    expect(normalizeCollection(null)).toBeUndefined();
    expect(normalizeCollection('13')).toBeUndefined();
  });

  it('keys two equal collections alike and two different ones apart', () => {
    const a = collectionFromSave({ colecao: { energia: 13.03 } });
    expect(collectionKey(a)).toBe(collectionKey({ ...a }));
    expect(collectionKey(a)).not.toBe(collectionKey(NO_COLLECTION));
    expect(collectionKey(undefined)).toBe(collectionKey(NO_COLLECTION));
  });
});

describe('where the game applies each axis — measured on one account, two reads twenty minutes apart', () => {
  // Between the two reads the account's crit-damage collection went 0 → 0.22 and its cooldown
  // collection 0 → 0.71, nothing else on these heroes moved. Wire units: crit_dmg is a multiplier
  // on 1, cooldown_reduction a fraction.
  const TREE_CRIT_DMG_ADD = 1.0788461520000001;
  const CRIT_DMG_PAIRS: readonly [number, number][] = [
    [3.28955904702086, 3.2922226153899063],
    [3.38032597237831, 3.383189227983142],
    [2.6130804284437725, 2.614255743851949],
  ];
  const CDR_PAIRS: readonly [number, number][] = [
    [0.11732687065440539, 0.11815989143605168],
    [0.06803758941140686, 0.06852065629622786],
    [0.00669639228020698, 0.0067439366653964505],
  ];

  it('crit damage scales the excess below the tree’s flat add, not the whole value', () => {
    const treeCritDmgPct = TREE_CRIT_DMG_ADD * 100;
    for (const [before, after] of CRIT_DMG_PAIRS) {
      const sheet = saveSheetUnits({ crit_dmg: before });
      const applied = applyCollection(sheet, { ...SHEET_COLLECTION, critDmgPct: 0.22 }, treeCritDmgPct);
      expect(applied.critDmg).toBeCloseTo(saveSheetUnits({ crit_dmg: after }).critDmg, 10);
    }
  });

  it('cooldown multiplies the whole value', () => {
    for (const [before, after] of CDR_PAIRS) {
      const applied = applyCollection(saveSheetUnits({ cooldown_reduction: before }), { ...SHEET_COLLECTION, cdrPct: 0.71 }, 0);
      expect(applied.cdr).toBeCloseTo(saveSheetUnits({ cooldown_reduction: after }).cdr, 12);
    }
  });

  it('damage is already inside dmg_static, to the bit — nothing applies it a second time', () => {
    const teamDmgAdd = 2.0182407409999996;
    const geoMult = 1.833785108311291;
    expect((1 + teamDmgAdd) * geoMult * 1.045).toBe(5.783871145730727);
  });

  it('strip is the exact inverse of apply', () => {
    const sheet = { attack: 100, energy: 400, speed: 90, critChance: 31, critDmg: 228, penetration: 70, cdr: 11, luck: 139 };
    const back = stripCollection(applyCollection(sheet, SHEET_COLLECTION, 107.88), SHEET_COLLECTION, 107.88);
    for (const key of SHEET_KEYS) expect(back[key]).toBeCloseTo(sheet[key], 10);
  });
});

describe('a roster with Collections inverts to the same points it was built from', () => {
  const EXPORT_FILE = 'save-20260914-20heroes-phase101.json';
  const raw = loadFixtureJson(EXPORT_FILE);
  const totalsRaw = (raw.skills as Record<string, unknown>).totals as Record<string, unknown>;
  const tree: TreeSheetTotals = { ...treeTotalsFromSave(totalsRaw), collection: SHEET_COLLECTION };
  const subjects: readonly [string, number][] = [
    ['NotJ', 140],
    ['WB;KE', 121],
    ['Bellatrix', 151],
    ['Jon', 138],
    ['BP 04', 23],
  ];

  it.each(subjects)('%s L%i', (name, level) => {
    const hero = extractHero(raw, name, level);
    if (!hero.birth) throw new Error(`${name} carries no birth stats`);
    const base = { birth: hero.birth, level: hero.level, stars: hero.stars, sheetOther: hero.sheetOther, loadout: hero.loadout };
    const plain = inferSpentPoints({ ...base, tree: treeTotalsFromSave(totalsRaw), sheet: hero.sheet, statPointsAvailable: hero.statPointsAvailable });
    expect(plain.issues).toEqual([]);

    const sheetWithCollection = composeSheetFromBirth({ ...base, pts: plain.pts, tree });
    const recovered = inferSpentPoints({ ...base, tree, sheet: sheetWithCollection, statPointsAvailable: hero.statPointsAvailable });
    expect(recovered.issues).toEqual([]);
    expect(recovered.pts).toEqual(plain.pts);

    const lines = peelSheetSources({ ...base, pts: plain.pts, tree });
    for (const key of SHEET_KEYS) {
      const sum = lines[key].hero + lines[key].gear + lines[key].ability + lines[key].skillTree;
      expect(sum, `${key} lines sum to the composed value`).toBeCloseTo(sheetWithCollection[key], 6);
    }
  });

  it('the same sheet without the bonus over-recovers points — the failure the bonus caused', () => {
    const hero = extractHero(raw, 'Bellatrix', 151);
    if (!hero.birth) throw new Error('Bellatrix carries no birth stats');
    const base = { birth: hero.birth, level: hero.level, stars: hero.stars, sheetOther: hero.sheetOther, loadout: hero.loadout };
    const plainTree = treeTotalsFromSave(totalsRaw);
    const pts = inferSpentPoints({ ...base, tree: plainTree, sheet: hero.sheet, statPointsAvailable: hero.statPointsAvailable }).pts;
    const sheetWithCollection = composeSheetFromBirth({ ...base, pts, tree });
    const naive = inferSpentPoints({ ...base, tree: plainTree, sheet: sheetWithCollection, statPointsAvailable: hero.statPointsAvailable });
    expect(naive.issues.length).toBeGreaterThan(0);
  });
});

describe('applySkillTree', () => {
  it('leaves attack, speed, penetration and luck to the tree alone', () => {
    const sheet = { attack: 100, energy: 400, speed: 90, critChance: 31, critDmg: 128, penetration: 70, cdr: 11, luck: 39 };
    const plainTree: TreeSheetTotals = { danoStatic: 2, energyPct: 10, speedPct: 5, critChancePct: 3, critDmgPct: 100, luckFlatPct: 40 };
    const withCollection = applySkillTree(sheet, sheet, emptySheetOther(), {
      ...plainTree,
      collection: SHEET_COLLECTION,
    });
    const without = applySkillTree(sheet, sheet, emptySheetOther(), plainTree);
    expect(withCollection.attack).toBe(without.attack);
    expect(withCollection.speed).toBe(without.speed);
    expect(withCollection.penetration).toBe(without.penetration);
    expect(withCollection.luck).toBe(without.luck);
    expect(withCollection.energy).toBeCloseTo(without.energy * 1.1303, 10);
  });
});

describe('skill-tree node pricing keeps the damage the server folds into dmg_static', () => {
  it('a node that touches no damage leaves dmg_static exactly where the server put it', () => {
    const server: SkillTotals = {
      team_dmg_add: 2.0182407409999996,
      crit_chance_add: 0.365009594305,
      crit_dmg_add: 1.0788461520000001,
      speed_add: 0.2356985766,
      coin_add: 3.290625,
      luck_add: 0.4003840015000001,
      energia_add: 2.4613559325,
      xp_mult: 1.9832086158983997,
      geo_mult: 1.833785108311291,
      dmg_static: 5.783871145730727,
      vagas_campo: 8,
      bag_tabs_bonus: 2,
    };
    const luckNode = SKILL_TREE.nodes.find((node) => node.effects.every((effect) => effect.kind === 'g_luck'));
    if (!luckNode) throw new Error('the catalog carries no luck-only node');
    expect(totalsWithNode(server, luckNode).dmg_static).toBeCloseTo(server.dmg_static, 12);
  });
});

describe('Collections gold — measured on the props the game paid out', () => {
  // Phase 151, outside any return-bonus window and Fortuna aura: Team Coin `coin_add` 3.290625,
  // Collections `ouro` 13.14. One integer per prop rarity seen (none of rarity 4 dropped), each
  // paid many times over.
  const COIN_MULT = 1 + 3.290625;
  const PAID_BY_RARITY: Readonly<Record<number, number>> = { 0: 7282, 1: 10194, 2: 13107, 3: 16020, 5: 21845 };
  const base = wikiPhaseLine(151)?.goldComum ?? Number.NaN;

  it('multiplies on top of Team Coin — every observed payout reproduces to the integer', () => {
    for (const rarity of [0, 1, 2, 3, 5]) {
      const paid = base * goldRarityMult(rarity) * COIN_MULT * collectionGoldMult({ goldPct: 13.14 });
      expect(Math.round(paid), `rarity ${String(rarity)}`).toBe(PAID_BY_RARITY[rarity]);
    }
  });

  it('added to Team Coin instead, not one payout reproduces', () => {
    for (const rarity of [0, 1, 2, 3, 5]) {
      const paid = base * goldRarityMult(rarity) * (COIN_MULT + 0.1314);
      expect(Math.round(paid)).not.toBe(PAID_BY_RARITY[rarity]);
    }
  });
});

describe('the economy axes', () => {
  it('gold multiplies on top, luck adds flat points, and both read absent as nothing', () => {
    expect(collectionGoldMult({ goldPct: 10.31 })).toBeCloseTo(1.1031, 12);
    expect(collectionGoldMult(undefined)).toBe(1);
    expect(collectionLuckPct({ luckPct: 1.02 })).toBe(1.02);
    expect(collectionLuckPct(null)).toBe(0);
  });
});
