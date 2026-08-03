import { describe, expect, it, vi } from 'vitest';
import {
  applyGear,
  applyPoints,
  reverseSheet,
  reverseGear,
  projectGearedOntoLoadout,
  emptyLoadout,
  emptySheetOther,
  upgradeMult,
  sumGearBonuses,
  gearBonusDeltas,
  defaultNaked,
  rescaleNakedForLevel,
  rescaleNakedCrit,
  rescaleNakedCritChance,
  rescaleNakedCritDmg,
  rescaleNakedPen,
  rescaleNakedForStars,
  rescaleHeroForLevel,
  rescaleHeroForStars,
  rescaleCatalogApply,
  starsMult,
  itemLabel,
  type SheetStats,
  type Loadout,
  type EquippedItem,
  type GearBonuses,
  type SheetOtherPct,
} from '@bombfarm/domain/gear';
import {
  BASE_ROLLS,
  POINT_GAIN,
  abilityMods,
  attackPointGain,
  levelPowerMult,
  nakedFromBirth,
} from '@bombfarm/domain/model';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';

const naked = (): SheetStats => ({
  attack: 200,
  energy: 300,
  speed: 50,
  critChance: 10,
  critDmg: 70,
  penetration: 5,
  cdr: 5,
  luck: 20,
});

function weapon(partial?: Partial<EquippedItem>): EquippedItem {
  return {
    defId: 'clay_arma',
    rarityIdx: 2,
    level: 40,
    upgrade: 0,
    ...partial,
  };
}

const zeroBonuses = (): GearBonuses => ({
  dmgFlat: 0,
  energyPct: 0,
  speedPct: 0,
  luckPct: 0,
  critPct: 0,
  penPct: 0,
  cdrPct: 0,
});

describe('upgradeMult', () => {
  it('uses +8% per forja level', () => {
    expect(upgradeMult(0)).toBe(1);
    expect(upgradeMult(5)).toBeCloseTo(1.4, 6);
    expect(upgradeMult(15)).toBeCloseTo(2.2, 6);
  });
});

describe('itemLabel lang', () => {
  it('EN composed label has English slot + rarity, no PT tokens', () => {
    const label = itemLabel(weapon({ rarityIdx: 2, level: 40 }), 'en');
    expect(label).toMatch(/Weapon/);
    expect(label).toMatch(/Rare/);
    expect(label).not.toMatch(/\barma\b/);
    expect(label).not.toMatch(/\bRaro\b/);
  });

  it('PT composed label keeps Portuguese slot + rarity', () => {
    const label = itemLabel(weapon({ rarityIdx: 2, level: 40 }), 'pt');
    expect(label).toMatch(/Arma/);
    expect(label).toMatch(/Raro/);
  });

  it('keeps defId / rarityIdx stable (display only)', () => {
    const eq = weapon({ defId: 'clay_arma', rarityIdx: 3 });
    itemLabel(eq, 'en');
    expect(eq.defId).toBe('clay_arma');
    expect(eq.rarityIdx).toBe(3);
  });

  it('PT set names are translated', () => {
    const label = itemLabel(weapon({ defId: 'clay_arma', rarityIdx: 2, level: 40 }), 'pt');
    expect(label).toMatch(/^Argila /);
    expect(label).not.toMatch(/\bClay\b/);
  });
});

describe('gearBonusDeltas', () => {
  it('returns zeros when current and clone match', () => {
    const loadout: Loadout = emptyLoadout();
    loadout.arma = weapon({ upgrade: 10 });
    const b = sumGearBonuses(loadout);
    const d = gearBonusDeltas(b, b);
    for (const k of Object.keys(d) as (keyof GearBonuses)[]) {
      expect(d[k]).toBe(0);
    }
  });

  it('reports absolute clone−current deltas (incl. from-zero CDR)', () => {
    const current = zeroBonuses();
    current.energyPct = 1.726;
    current.dmgFlat = 1543.3;
    const alt = zeroBonuses();
    alt.energyPct = 2.176;
    alt.dmgFlat = 1543.3;
    alt.penPct = 4.32;
    alt.cdrPct = 2.4;
    const d = gearBonusDeltas(current, alt);
    expect(d.dmgFlat).toBeCloseTo(0, 6);
    expect(d.energyPct).toBeCloseTo(0.45, 6);
    expect(d.penPct).toBeCloseTo(4.32, 6);
    expect(d.cdrPct).toBeCloseTo(2.4, 6);
    expect(d.speedPct).toBe(0);
  });

  it('is negative when the clone is weaker', () => {
    const current = zeroBonuses();
    current.critPct = 2.0;
    const alt = zeroBonuses();
    alt.critPct = 1.5;
    expect(gearBonusDeltas(current, alt).critPct).toBeCloseTo(-0.5, 6);
  });
});

describe('projectGearedOntoLoadout', () => {
  it('is identity when from and to loadouts match', () => {
    const loadout: Loadout = emptyLoadout();
    loadout.arma = weapon({ upgrade: 10 });
    const geared = applyGear(naked(), loadout);
    const drifted: SheetStats = { ...geared, attack: geared.attack + 2.5, speed: geared.speed + 0.1 };
    const projected = projectGearedOntoLoadout(drifted, loadout, loadout);
    for (const k of Object.keys(drifted) as (keyof SheetStats)[]) {
      expect(projected[k]).toBeCloseTo(drifted[k], 8);
    }
  });

  it('applies the gear swap relative to the observed sheet', () => {
    const from: Loadout = emptyLoadout();
    from.arma = weapon({ upgrade: 5 });
    const to: Loadout = emptyLoadout();
    to.arma = weapon({ upgrade: 15 });
    const geared = applyGear(naked(), from);
    const projected = projectGearedOntoLoadout(geared, from, to);
    const expected = applyGear(reverseGear(geared, from), to);
    for (const k of Object.keys(expected) as (keyof SheetStats)[]) {
      expect(projected[k]).toBeCloseTo(expected[k], 8);
    }
  });
});

describe('shared-pool gear math', () => {
  it('adds flat attack and multiplies energy', () => {
    const loadout: Loadout = emptyLoadout();
    // Prefer a real catalog weapon if present; otherwise empty bonuses still exercise forward path.
    loadout.arma = weapon();
    const geared = applyGear(naked(), loadout);
    const bonuses = sumGearBonuses(loadout);
    expect(geared.attack).toBeCloseTo(naked().attack + bonuses.dmgFlat, 4);
    expect(geared.energy).toBeCloseTo(naked().energy * (1 + bonuses.energyPct), 4);
    expect(geared.critDmg).toBe(naked().critDmg);
  });

  it('round-trips reverseSheet through applyPoints', () => {
    const loadout = emptyLoadout();
    const pts = {
      attack: 2,
      energy: 1,
      speed: 0,
      critChance: 3,
      critDmg: 1,
      penetration: 0,
      cdr: 0,
      luck: 0,
    };
    const other = emptySheetOther();
    other.critChance = 0.15; // Olho-like sheet ability
    const sheet = applyPoints(naked(), loadout, pts, other);
    const recovered = reverseSheet(sheet, loadout, pts, other);
    for (const k of Object.keys(naked()) as (keyof SheetStats)[]) {
      expect(recovered[k]).toBeCloseTo(naked()[k], 4);
    }
  });

  it('scales flat attack/energy point gains by starsMult and round-trips with reverseSheet', () => {
    const loadout = emptyLoadout();
    const pts = {
      attack: 3,
      energy: 2,
      speed: 0,
      critChance: 0,
      critDmg: 0,
      penetration: 0,
      cdr: 0,
      luck: 0,
    };
    const level = 55;
    const stars = 1;
    const star = starsMult(stars);
    const base = naked();
    const sheet = applyPoints(base, loadout, pts, emptySheetOther(), level, stars);
    expect(sheet.attack - base.attack).toBeCloseTo(pts.attack * attackPointGain(level) * star, 6);
    expect(sheet.energy - base.energy).toBeCloseTo(pts.energy * POINT_GAIN.energyNative * star, 6);

    const recovered = reverseSheet(sheet, loadout, pts, emptySheetOther(), level, stars);
    for (const k of Object.keys(base) as (keyof SheetStats)[]) {
      expect(recovered[k]).toBeCloseTo(base[k], 4);
    }
  });

  it('compounds points into the shared % pool', () => {
    const loadout = emptyLoadout();
    const other = emptySheetOther();
    const pts = {
      attack: 0,
      energy: 0,
      speed: 2,
      critChance: 0,
      critDmg: 0,
      penetration: 0,
      cdr: 0,
      luck: 0,
    };
    const sheet = applyPoints(naked(), loadout, pts, other);
    const expected =
      (naked().speed * (1 + 2 * POINT_GAIN.speedPctOfBase)) / 1;
    expect(sheet.speed).toBeCloseTo(expected, 6);
  });
});

describe('defaultNaked (static naked sheet)', () => {
  it('scales only Attack with level, everything else stays at the base roll', () => {
    const lv1 = defaultNaked('Raro', 1);
    const lv30 = defaultNaked('Raro', 30);
    expect(lv30.attack).toBeCloseTo(BASE_ROLLS.Raro.attack * levelPowerMult(30), 6);
    expect(lv30.energy).toBe(lv1.energy);
    expect(lv30.speed).toBe(lv1.speed);
    expect(lv30.critChance).toBe(lv1.critChance);
    expect(lv30.critDmg).toBe(lv1.critDmg);
    expect(lv30.penetration).toBe(lv1.penetration);
    expect(lv30.cdr).toBe(lv1.cdr);
  });

  it('bakes a sheet-ability bonus (e.g. Olho Clínico) into naked crit %', () => {
    const withOlho10 = defaultNaked('Incomum', 1, { ...emptySheetOther(), critChance: 0.15 });
    const withOlho0 = defaultNaked('Incomum', 1);
    expect(withOlho10.critChance).toBeCloseTo(BASE_ROLLS.Incomum.critChance * 1.15, 6);
    expect(withOlho0.critChance).toBe(BASE_ROLLS.Incomum.critChance);
  });

  it('bakes Ponta via abilityMods sheetPenetrationRaw (base ≈ 3% → 3 / 6 / 33, W3 perLevel 1.0)', () => {
    const basePen = 3;
    const nakedBase = { ...naked(), penetration: basePen };
    for (const [rank, expected] of [
      [0, 3],
      [1, 6],
      [10, 33],
    ] as const) {
      const mods = abilityMods(rank > 0 ? { ponta_diamante: rank } : {});
      expect(mods.penetrationPp).toBe(0);
      expect(mods.sheetPenetrationRaw).toBe(1 * rank);
      const rescaled = rescaleNakedPen(nakedBase, 0, mods.sheetPenetrationRaw);
      expect(rescaled.penetration).toBeCloseTo(expected, 6);
      const fromDefault = defaultNaked('Raro', 1, {
        ...emptySheetOther(),
        penetration: mods.sheetPenetrationRaw,
      });
      expect(fromDefault.penetration).toBeCloseTo(
        BASE_ROLLS.Raro.penetration * (1 + mods.sheetPenetrationRaw),
        6,
      );
    }
  });

  it('scales Attack, Energy, Crit %, Crit Dmg, Pen, CDR with stars; Speed exempt (1★ = ×1.5)', () => {
    const noStars = defaultNaked('Lendária', 1, undefined, 0);
    const oneStar = defaultNaked('Lendária', 1, undefined, 1);
    expect(oneStar.attack).toBeCloseTo(noStars.attack * 1.5, 6);
    expect(oneStar.energy).toBeCloseTo(noStars.energy * 1.5, 6);
    expect(oneStar.critChance).toBeCloseTo(noStars.critChance * 1.5, 6);
    expect(oneStar.critDmg).toBeCloseTo(noStars.critDmg * 1.5, 6);
    expect(oneStar.penetration).toBeCloseTo(noStars.penetration * 1.5, 6);
    expect(oneStar.cdr).toBeCloseTo(noStars.cdr * 1.5, 6);
    expect(oneStar.speed).toBe(noStars.speed);
  });
});

describe('defaultNaked vs nakedFromBirth (BSPW4-07, AC-48)', () => {
  it('differ for a hero whose birth rolls are not the rarity midpoint (Bellatrix crit chance 9.51 vs Raro 7)', () => {
    // defaultNaked is the hand-built-hero rarity-midpoint FALLBACK (Wave 2's stated
    // position — a real hero's luck/crit chance comes from birth_stats, not the midpoint).
    // A birth-backed hero must never silently land on the fallback.
    const bellatrixBirth = { ...naked(), critChance: 9.51 };
    const fromBirth = nakedFromBirth(bellatrixBirth, 1, 0, emptySheetOther());
    const fallback = defaultNaked('Raro', 1);
    expect(fromBirth.critChance).toBeCloseTo(9.51, 6);
    expect(fallback.critChance).toBeCloseTo(BASE_ROLLS.Raro.critChance, 6);
    expect(fromBirth.critChance).not.toBeCloseTo(fallback.critChance, 1);
  });
});

describe('starsMult (wiki: Gemas & Estrelas ritual)', () => {
  it('maps 0/1/2/3 stars to ×1/×1.5/×2/×2.5', () => {
    expect(starsMult(0)).toBe(1);
    expect(starsMult(1)).toBe(1.5);
    expect(starsMult(2)).toBe(2);
    expect(starsMult(3)).toBe(2.5);
  });

  it('clamps out-of-range star counts to 0..3', () => {
    expect(starsMult(-1)).toBe(1);
    expect(starsMult(5)).toBe(2.5);
  });
});

describe('rescaleNakedForStars', () => {
  it('rescales starred stats and preserves Speed (and identity of untouched fields)', () => {
    const custom: SheetStats = { ...naked(), critChance: 12.3, speed: 55.5 };
    const next = rescaleNakedForStars(custom, 0, 2);
    expect(next.attack).toBeCloseTo(custom.attack * 2, 6);
    expect(next.energy).toBeCloseTo(custom.energy * 2, 6);
    expect(next.critChance).toBeCloseTo(custom.critChance * 2, 6);
    expect(next.critDmg).toBeCloseTo(custom.critDmg * 2, 6);
    expect(next.penetration).toBeCloseTo(custom.penetration * 2, 6);
    expect(next.cdr).toBeCloseTo(custom.cdr * 2, 6);
    expect(next.speed).toBe(custom.speed);
  });

  it('rescales luck alongside the other starred stats (BSPW2-AC-06)', () => {
    const custom: SheetStats = { ...naked(), luck: 8.4 };
    const next = rescaleNakedForStars(custom, 0, 2);
    expect(next.luck).toBeCloseTo(custom.luck * 2, 6);
  });

  it('is a no-op when the star count does not change', () => {
    const n = naked();
    expect(rescaleNakedForStars(n, 1, 1)).toBe(n);
  });
});

describe('rescaleNakedForLevel', () => {
  it('rescales only Attack, preserving every other (possibly custom) stat', () => {
    const custom: SheetStats = { ...naked(), critChance: 12.3 }; // e.g. from Infer naked
    const next = rescaleNakedForLevel(custom, 1, 26);
    expect(next.attack).toBeCloseTo(custom.attack * (levelPowerMult(26) / levelPowerMult(1)), 6);
    expect(next.critChance).toBe(custom.critChance);
    expect(next.energy).toBe(custom.energy);
  });

  it('leaves luck untouched — level does not scale luck (BSPW2-AC-06, ASM-04)', () => {
    const custom: SheetStats = { ...naked(), luck: 8.4 };
    const next = rescaleNakedForLevel(custom, 1, 26);
    expect(next.luck).toBe(custom.luck);
  });

  it('is a no-op when the level power multiplier does not change', () => {
    const n = naked();
    expect(rescaleNakedForLevel(n, 5, 5)).toBe(n);
  });
});

describe('rescaleNakedPen', () => {
  it('rescales only penetration by (1+newOther)/(1+oldOther)', () => {
    const custom: SheetStats = { ...naked(), attack: 999, penetration: 9 };
    const next = rescaleNakedPen(custom, 2, 20);
    expect(next.penetration).toBeCloseTo(9 * (21 / 3), 6);
    expect(next.attack).toBe(custom.attack);
    expect(next.critChance).toBe(custom.critChance);
  });

  it('is a no-op when other raw Σ does not change', () => {
    const n = naked();
    expect(rescaleNakedPen(n, 10, 10)).toBe(n);
  });
});

describe('rescaleNakedCritDmg', () => {
  it('rescales only crit dmg by (1+newOther)/(1+oldOther), preserving other stats (DEC-06 ratio form)', () => {
    const custom: SheetStats = { ...naked(), attack: 999, critDmg: 90 };
    const next = rescaleNakedCritDmg(custom, 0, 0.52); // Golpe Brutal rank 13: 0.04 * 13
    expect(next.critDmg).toBeCloseTo(90 * 1.52, 6);
    expect(next.attack).toBe(custom.attack);
    expect(next.critChance).toBe(custom.critChance);
    expect(next.penetration).toBe(custom.penetration);
  });

  it('is a no-op (same reference) when other pct does not change', () => {
    const n = naked();
    expect(rescaleNakedCritDmg(n, 0.04, 0.04)).toBe(n);
  });

  it('clamps a negative old/new other pct to zero', () => {
    const custom: SheetStats = { ...naked(), critDmg: 100 };
    const next = rescaleNakedCritDmg(custom, -0.5, 0.08);
    expect(next.critDmg).toBeCloseTo(100 * 1.08, 6);
  });
});

describe('rescaleNakedCritChance (BSPW4-07, AC-44)', () => {
  it('rescales only crit chance by (1+newOther)/(1+oldOther), preserving other stats', () => {
    const custom: SheetStats = { ...naked(), attack: 999, critChance: 9.51 };
    const next = rescaleNakedCritChance(custom, 0, 0.075); // Olho Clínico rank 10, W3 0.75%/rank
    expect(next.critChance).toBeCloseTo(9.51 * 1.075, 6);
    expect(next.attack).toBe(custom.attack);
    expect(next.critDmg).toBe(custom.critDmg);
    expect(next.penetration).toBe(custom.penetration);
  });

  it('is a no-op (same reference) when other pct does not change', () => {
    const n = naked();
    expect(rescaleNakedCritChance(n, 0.075, 0.075)).toBe(n);
  });

  it('clamps a negative old/new other pct to zero', () => {
    const custom: SheetStats = { ...naked(), critChance: 10 };
    const next = rescaleNakedCritChance(custom, -0.5, 0.08);
    expect(next.critChance).toBeCloseTo(10 * 1.08, 6);
  });

  it('AC-45: disagrees with rescaleNakedCrit (rarity-midpoint reset) for a non-midpoint hero, and preserves the hero\'s own roll', () => {
    // Bellatrix's actual birth crit-chance roll (9.51) vs Raro's rarity midpoint (7) — a 36%
    // error (spec.md's evidence table). The two forms must NOT agree.
    const bellatrixCritChance = 9.51;
    const custom: SheetStats = { ...naked(), critChance: bellatrixCritChance };

    const ratioForm = rescaleNakedCritChance(custom, 0, 0.15);
    const midpointForm = rescaleNakedCrit(custom, 'Raro', 0.15);

    expect(ratioForm.critChance).toBeCloseTo(bellatrixCritChance * 1.15, 6);
    expect(midpointForm.critChance).toBeCloseTo(BASE_ROLLS.Raro.critChance * 1.15, 6);
    expect(ratioForm.critChance).not.toBeCloseTo(midpointForm.critChance, 1);
    // The ratio form preserves the 9.51-derived value; the midpoint form discards it.
    expect(ratioForm.critChance / bellatrixCritChance).toBeCloseTo(1.15, 6);
  });
});

describe('rescaleNakedCrit', () => {
  it('rescales only crit %, preserving every other (possibly custom) stat', () => {
    const custom: SheetStats = { ...naked(), attack: 999 }; // e.g. from a level-up rescale
    const next = rescaleNakedCrit(custom, 'Comum', 0.15);
    expect(next.critChance).toBeCloseTo(BASE_ROLLS.Comum.critChance * 1.15, 6);
    expect(next.attack).toBe(custom.attack);
    expect(next.speed).toBe(custom.speed);
  });

  it('keeps the star multiplier when rebuilding crit from Olho other', () => {
    const custom: SheetStats = { ...naked(), critChance: 99 };
    const next = rescaleNakedCrit(custom, 'Comum', 0.15, 2);
    expect(next.critChance).toBeCloseTo(BASE_ROLLS.Comum.critChance * 1.15 * starsMult(2), 6);
  });
  it('clamps a negative other pct to zero', () => {
    const next = rescaleNakedCrit(naked(), 'Comum', -0.5);
    expect(next.critChance).toBe(BASE_ROLLS.Comum.critChance);
  });
});

describe('rescaleHeroForLevel / rescaleHeroForStars (residual + re-apply)', () => {
  const pontaOther = (): SheetOtherPct => ({
    ...emptySheetOther(),
    penetration: 20, // Ponta de Diamante 10
  });

  function flatWeaponLoadout(): Loadout {
    const loadout = emptyLoadout();
    loadout.arma = weapon({ upgrade: 10 });
    return loadout;
  }

  function expectedGeared(
    oldNaked: SheetStats,
    newNaked: SheetStats,
    geared: SheetStats,
    loadout: Loadout,
    sheetOther: SheetOtherPct,
  ): SheetStats {
    const oldCatalog = applyGear(oldNaked, loadout, sheetOther);
    const newCatalog = applyGear(newNaked, loadout, sheetOther);
    const next = { ...newCatalog };
    for (const k of SHEET_KEYS) {
      next[k] = newCatalog[k] + (geared[k] - oldCatalog[k]);
    }
    return next;
  }

  it('LVL-01/02: level change rescales naked and applies residual + re-apply with sheetOther', () => {
    const from = 1;
    const to = 26;
    const loadout = flatWeaponLoadout();
    const other = pontaOther();
    const n0 = naked();
    const catalog = applyGear(n0, loadout, other);
    const geared: SheetStats = { ...catalog, attack: catalog.attack + 3.7, speed: catalog.speed + 0.4 };
    const result = rescaleHeroForLevel(n0, geared, loadout, other, from, to);
    const expectedNaked = rescaleNakedForLevel(n0, from, to);
    expect(result.naked.attack).toBeCloseTo(expectedNaked.attack, 8);
    expect(result.naked.energy).toBe(n0.energy);
    expect(result.geared).toEqual(expectedGeared(n0, expectedNaked, geared, loadout, other));
  });

  it('AC-21: rescale keeps full precision — result is not truncated to 1 dp (BSP-28)', () => {
    const from = 1;
    const to = 26;
    const loadout = flatWeaponLoadout();
    const other = pontaOther();
    const n0 = naked();
    const catalog = applyGear(n0, loadout, other);
    // Odd-decimal residuals so the summed result is very unlikely to land on a 1 dp value.
    const geared: SheetStats = {
      ...catalog,
      attack: catalog.attack + 3.73,
      penetration: catalog.penetration + 0.137,
    };
    const result = rescaleHeroForLevel(n0, geared, loadout, other, from, to);
    const expectedNaked = rescaleNakedForLevel(n0, from, to);
    const expected = expectedGeared(n0, expectedNaked, geared, loadout, other);
    expect(result.geared).toEqual(expected);
    expect(Number(result.geared.penetration.toFixed(1))).not.toBe(result.geared.penetration);
  });

  it('LVL-02 residual=0: new geared equals applyGear(newNaked, loadout, sheetOther) exactly', () => {
    const loadout = flatWeaponLoadout();
    const other = pontaOther();
    const n0 = naked();
    const geared = applyGear(n0, loadout, other);
    const result = rescaleHeroForLevel(n0, geared, loadout, other, 1, 26);
    const newNaked = rescaleNakedForLevel(n0, 1, 26);
    expect(result.geared).toEqual(applyGear(newNaked, loadout, other));
  });

  it('LVL-02 residual≠0: residual is preserved after level rescale (not wiped to catalog)', () => {
    const loadout = flatWeaponLoadout();
    const other = pontaOther();
    const n0 = naked();
    const catalog = applyGear(n0, loadout, other);
    const residual = {
      attack: 5.5,
      energy: 1.2,
      speed: 0.3,
      critChance: 0,
      critDmg: 0,
      penetration: 0.2,
      cdr: 0,
      luck: 0.1,
    };
    const geared: SheetStats = {
      attack: catalog.attack + residual.attack,
      energy: catalog.energy + residual.energy,
      speed: catalog.speed + residual.speed,
      critChance: catalog.critChance + residual.critChance,
      critDmg: catalog.critDmg + residual.critDmg,
      penetration: catalog.penetration + residual.penetration,
      cdr: catalog.cdr + residual.cdr,
      luck: catalog.luck + residual.luck,
    };
    const result = rescaleHeroForLevel(n0, geared, loadout, other, 1, 26);
    const newCatalog = applyGear(result.naked, loadout, other);
    const expected: SheetStats = { ...newCatalog };
    for (const k of SHEET_KEYS) {
      expected[k] = newCatalog[k] + residual[k];
    }
    expect(result.geared).toEqual(expected);
  });

  it('LVL-03: flat weapon — geared attack delta equals naked attack delta within rounding', () => {
    const loadout = flatWeaponLoadout();
    const other = emptySheetOther();
    const n0 = naked();
    const bonuses = sumGearBonuses(loadout);
    expect(bonuses.dmgFlat).toBeGreaterThan(0);
    const geared = applyGear(n0, loadout, other);
    const result = rescaleHeroForLevel(n0, geared, loadout, other, 1, 26);
    const nakedDelta = result.naked.attack - n0.attack;
    const gearedDelta = result.geared.attack - geared.attack;
    expect(gearedDelta).toBeCloseTo(nakedDelta, 1);
  });

  it('LVL-04: level change does not invent energy growth; non-attack stats follow applyGear', () => {
    const loadout = flatWeaponLoadout();
    const other = pontaOther();
    const n0 = naked();
    const geared = applyGear(n0, loadout, other);
    const result = rescaleHeroForLevel(n0, geared, loadout, other, 1, 26);
    expect(result.naked.energy).toBe(n0.energy);
    const newCatalog = applyGear(result.naked, loadout, other);
    expect(result.geared.energy).toBeCloseTo(newCatalog.energy, 8);
    expect(result.geared.speed).toBeCloseTo(newCatalog.speed, 8);
    expect(result.geared.critChance).toBeCloseTo(newCatalog.critChance, 8);
    expect(result.geared.critDmg).toBeCloseTo(newCatalog.critDmg, 8);
    expect(result.geared.penetration).toBeCloseTo(newCatalog.penetration, 8);
    expect(result.geared.cdr).toBeCloseTo(newCatalog.cdr, 8);
  });

  it('LVL-05: unchanged level returns the same naked and geared references', () => {
    const loadout = flatWeaponLoadout();
    const other = pontaOther();
    const n0 = naked();
    const geared = applyGear(n0, loadout, other);
    const result = rescaleHeroForLevel(n0, geared, loadout, other, 12, 12);
    expect(result.naked).toBe(n0);
    expect(result.geared).toBe(geared);
  });

  it('LVL-06: non-empty sheetOther is used in both catalogs (residual formula)', () => {
    const loadout = flatWeaponLoadout();
    const other = pontaOther();
    const n0 = naked();
    const withOther = applyGear(n0, loadout, other);
    const without = applyGear(n0, loadout, emptySheetOther());
    // Catalogs MUST differ when sheetOther is dropped — prove other is material.
    expect(withOther.penetration).not.toBeCloseTo(without.penetration, 4);

    const geared: SheetStats = { ...withOther, penetration: withOther.penetration + 1.1 };
    const newNaked = rescaleNakedForLevel(n0, 1, 26);
    // Call-site spy: kills symmetric emptySheetOther() drop (output-equality alone cannot).
    const spy = vi.spyOn(rescaleCatalogApply, 'applyGear');
    const result = rescaleHeroForLevel(n0, geared, loadout, other, 1, 26);
    expect(spy).toHaveBeenCalledTimes(2);
    for (const call of spy.mock.calls) {
      expect(call[2]).toBe(other);
      expect(call[2]).toEqual(other);
      expect(call[2]!.penetration).toBe(20);
    }
    spy.mockRestore();
    // Locked formula: both applyGear calls pass sheetOther (not emptySheetOther).
    expect(result.geared).toEqual(expectedGeared(n0, newNaked, geared, loadout, other));
    expect(result.geared.penetration).toBeCloseTo(
      applyGear(newNaked, loadout, other).penetration + 1.1,
      8,
    );
  });

  it('STAR-01/02/03: stars rescale naked (Speed exempt), then residual + re-apply', () => {
    const loadout = flatWeaponLoadout();
    const other = pontaOther();
    const n0 = naked();
    const catalog = applyGear(n0, loadout, other);
    const geared: SheetStats = { ...catalog, attack: catalog.attack + 2, energy: catalog.energy + 4 };
    const result = rescaleHeroForStars(n0, geared, loadout, other, 0, 1);
    const ratio = starsMult(1) / starsMult(0);
    expect(result.naked.attack).toBeCloseTo(n0.attack * ratio, 8);
    expect(result.naked.energy).toBeCloseTo(n0.energy * ratio, 8);
    expect(result.naked.critChance).toBeCloseTo(n0.critChance * ratio, 8);
    expect(result.naked.critDmg).toBeCloseTo(n0.critDmg * ratio, 8);
    expect(result.naked.penetration).toBeCloseTo(n0.penetration * ratio, 8);
    expect(result.naked.cdr).toBeCloseTo(n0.cdr * ratio, 8);
    expect(result.naked.speed).toBe(n0.speed);
    expect(result.geared).toEqual(
      expectedGeared(n0, rescaleNakedForStars(n0, 0, 1), geared, loadout, other),
    );
  });

  it('STAR-04: stars 0→1→0 round-trips naked and geared within tolerance', () => {
    const loadout = flatWeaponLoadout();
    const other = pontaOther();
    const n0 = naked();
    const catalog = applyGear(n0, loadout, other);
    const geared: SheetStats = { ...catalog, attack: catalog.attack + 1.5, energy: catalog.energy + 2.5 };
    const up = rescaleHeroForStars(n0, geared, loadout, other, 0, 1);
    const back = rescaleHeroForStars(up.naked, up.geared, loadout, other, 1, 0);
    for (const k of SHEET_KEYS) {
      expect(back.naked[k]).toBeCloseTo(n0[k], 8);
      expect(back.geared[k]).toBeCloseTo(geared[k], 1);
    }
  });

  it('STAR identity: unchanged stars returns the same naked and geared references', () => {
    const loadout = flatWeaponLoadout();
    const n0 = naked();
    const geared = applyGear(n0, loadout, emptySheetOther());
    const result = rescaleHeroForStars(n0, geared, loadout, emptySheetOther(), 2, 2);
    expect(result.naked).toBe(n0);
    expect(result.geared).toBe(geared);
  });
});
