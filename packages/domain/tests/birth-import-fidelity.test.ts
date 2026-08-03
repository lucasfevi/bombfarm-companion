/**
 * BSPW5-09 (BSP-34/34a/35) — the fidelity suite over the DEC-01 corpus: every birth-capable
 * fixture, every hero in it, every one of the 8 sheet keys, plus every equipped item's
 * `scaledValores`. This is the wave's closing proof that `parseSaveFile`'s wiring
 * (birthFromSave -> nakedFromBirth/composeSheetFromBirth -> inferSpentPoints, all through
 * the shared save-units.ts converter) agrees with the game's own displayed sheet on real
 * captures, not just on hand-built unit fixtures.
 *
 * DEC-01: the corpus is exactly these 7 fixtures — `gale-*` / `brenna-*` / `dara-*` are a
 * DIFFERENT, OLDER exporter version (verified: `birth_stats` is absent on 100% of their
 * 19/19/16 heroes). Mixing them in would silently compare two incompatible models
 * (pre-tree vs tree-inclusive). Those fixtures keep their other two jobs elsewhere
 * (sheet-math-fixtures.test.ts's direct-helper tests; `gale-01-points-reset.json` as the
 * BSP-01 real-file reject fixture in import-save.test.ts) — never here.
 */
import { describe, expect, it } from 'vitest';
import catalog from '@/shared/domain/data/catalog.json';
import { parseSaveFile } from '@/shared/domain/import-save';
import { composeSheetFromBirth, type TreeSheetTotals } from '@/shared/domain/birth-sheet';
import { birthFromSave, saveSheetUnits, treeTotalsFromSave } from '@/shared/domain/save-units';
import { abilityMods } from '@/shared/domain/model';
import { derive } from '@/shared/domain/derive';
import { emptySheetOther, scaledValores, type SheetOtherPct } from '@/shared/domain/gear';
import { SHEET_KEYS } from '@/shared/domain/planner-constants';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

/** DEC-01 — the 7 birth-capable fixtures, and only these. */
const DEC01_FIXTURES = [
  'vera-01-points-reset.json',
  'vera-02-pts-luck-1.json',
  'vera-03-pts-each-1.json',
  'bellatrix-01-points-reset.json',
  'bellatrix-02-pts-each-1.json',
  'save-20260731-11heroes.json',
  'save-20260801-crit-dmg-tree.json',
] as const;

/** BSP-34's gate — never widened. */
const SHEET_ABS_TOL = 0.01;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sheetOtherFor(abilities: Record<string, number>): SheetOtherPct {
  const mods = abilityMods(abilities);
  return {
    ...emptySheetOther(),
    critChance: mods.sheetCritChancePctOfBase / 100,
    penetration: mods.sheetPenetrationRaw,
    critDmg: mods.sheetCritDmgPctOfBase,
  };
}

describe('birth-import-fidelity (BSPW5-09, DEC-01 corpus)', () => {
  let heroCheckCount = 0;
  let worstSheetResidual = 0;
  let worstSheetDescription = '';

  for (const file of DEC01_FIXTURES) {
    const raw = loadFixtureJson(file);
    const { candidates, rejected } = parseSaveFile(raw, []);
    const heroesRaw = (isObject(raw) && Array.isArray(raw.heroes) ? raw.heroes : []).filter(isObject);
    const totalsRaw = isObject(raw) && isObject(raw.skills) && isObject(raw.skills.totals) ? raw.skills.totals : {};
    const tree: TreeSheetTotals = treeTotalsFromSave(totalsRaw);

    it(`${file}: is not rejected and yields a non-empty candidate list (L-10 anti-vacuity)`, () => {
      expect(rejected).toBeNull();
      expect(candidates.length).toBeGreaterThan(0);
    });

    for (const candidate of candidates) {
      it(`${file} :: ${candidate.name} (${candidate.sourceId}) — composeSheetFromBirth(pts=inferred) matches the save's stats within ${SHEET_ABS_TOL} abs on all 8 keys (AC-29)`, () => {
        heroCheckCount++;
        const rawHero = heroesRaw.find((hero) => hero.id === candidate.sourceId);
        expect(rawHero, `${file}: raw hero for ${candidate.sourceId} not found`).toBeDefined();
        if (!rawHero) return;

        const birth = birthFromSave(rawHero.birth_stats as Record<string, unknown>);
        const composed = composeSheetFromBirth({
          birth,
          level: candidate.level,
          stars: candidate.record.stars,
          sheetOther: sheetOtherFor(candidate.record.abilities),
          loadout: candidate.record.loadout,
          pts: candidate.record.pts,
          tree,
        });
        const expected = saveSheetUnits(rawHero.stats as Record<string, unknown>);

        for (const key of SHEET_KEYS) {
          const residual = Math.abs(composed[key] - expected[key]);
          expect(residual, `${file}:${candidate.name}.${key} — got ${composed[key]} want ${expected[key]}`).toBeLessThanOrEqual(
            SHEET_ABS_TOL,
          );
          if (residual > worstSheetResidual) {
            worstSheetResidual = residual;
            worstSheetDescription = `${file}:${candidate.name}.${key}`;
          }
        }
      });
    }
  }

  it('AC-30: the corpus is non-vacuous — 7 fixtures, >= 75 hero-checks total', () => {
    expect(DEC01_FIXTURES.length).toBe(7);
    expect(heroCheckCount).toBeGreaterThanOrEqual(75);
  });

  it('the worst observed sheet residual across the whole corpus stays far inside the gate', () => {
    expect(worstSheetResidual, worstSheetDescription).toBeLessThan(SHEET_ABS_TOL);
  });

  it('AC-31: save-20260801-crit-dmg-tree.json has a non-trivial skill-tree contribution and Bellatrix has Sigma pts > 0 (39 crit-damage points) — asserted, not assumed', () => {
    const raw = loadFixtureJson('save-20260801-crit-dmg-tree.json');
    const totals = (raw as { skills: { totals: Record<string, unknown> } }).skills.totals;
    expect(totals.dmg_static).toBeCloseTo(1.78324567735483, 9);
    expect(totals.crit_dmg_add).toBeCloseTo(0.196153846, 9);

    const { candidates } = parseSaveFile(raw, []);
    const bellatrix = candidates.find((c) => c.name === 'Bellatrix');
    expect(bellatrix).toBeDefined();
    expect(bellatrix?.record.pts.critDmg).toBe(39);
    const spentTotal = bellatrix ? SHEET_KEYS.reduce((sum, key) => sum + bellatrix.record.pts[key], 0) : 0;
    expect(spentTotal).toBeGreaterThan(0);
  });

  it('AC-33 (end-to-end, BSPW5-11/DISC-01): the STORED RECORD fed through derive with identity combat mults reproduces the save\'s stats within 0.01 abs on all 8 keys', () => {
    // Bram on save-20260801-crit-dmg-tree.json — the exact fixture DISC-01 names
    // (energia_add = 0.812711865, a 1.81x overstatement of every energy point pre-fix) —
    // with pts.energy = 12, a strong discriminating signal for the bug this task fixes.
    const raw = loadFixtureJson('save-20260801-crit-dmg-tree.json');
    const { candidates } = parseSaveFile(raw, []);
    const bram = candidates.find((c) => c.sourceId === '18606');
    expect(bram).toBeDefined();
    if (!bram) return;
    expect(bram.record.pts.energy).toBeGreaterThan(0);

    const totals = (raw as { skills: { totals: Record<string, unknown> } }).skills.totals;
    expect(totals.energia_add).toBeGreaterThan(0);
    const tree = treeTotalsFromSave(totals);

    const result = derive({
      geared: bram.record.gearedOverride,
      naked: bram.record.naked,
      sheetOther: sheetOtherFor(bram.record.abilities),
      pts: bram.record.pts,
      rarity: bram.rarity,
      level: bram.level,
      stars: bram.record.stars,
      attackMult: 1,
      energyMult: 1,
      speedMult: 1,
      critDmgMult: 1,
      teamCritPctOfBase: 0,
      treeSheet: tree,
      combatCritChancePctOfBase: 0,
      penetrationPp: 0,
      context: { restSeconds: 1, mitigation: 0, blastRange: 1, cycleModel: 'serial', walkDelay: 0, drainMult: 1 },
      dmgMult: 1,
      mitigationPct: 0,
    });

    const heroesRaw = (raw as { heroes: Record<string, unknown>[] }).heroes;
    const rawBram = heroesRaw.find((h) => h.id === '18606')!;
    const expected = saveSheetUnits(rawBram.stats as Record<string, unknown>);
    for (const key of SHEET_KEYS) {
      expect(Math.abs(result.adjusted[key] - expected[key]), `Bram.${key}`).toBeLessThanOrEqual(SHEET_ABS_TOL);
    }
  });

  describe('AC-32: every equipped item across the corpus reproduces scaledValores (BSP-34a / AD-BSP-24)', () => {
    let equippedItemCount = 0;
    let statCheckCount = 0;

    for (const file of DEC01_FIXTURES) {
      it(`${file}: every equipped item's stats[].effective matches scaledValores`, () => {
        const raw = loadFixtureJson(file);
        const items = isObject(raw) && Array.isArray(raw.items) ? raw.items.filter(isObject) : [];
        const equipped = items.filter((item) => item.equipped_on != null && item.equipped_on !== '');
        for (const item of equipped) {
          equippedItemCount++;
          const defId = String(item.def_id);
          const rarityIdx = Math.round(Number(item.rarity ?? 0));
          const level = Number(item.level ?? 0);
          const upgrade = Math.round(Number(item.upgrade ?? 0));
          const computed = scaledValores(defId, rarityIdx, level, upgrade);
          const stats = Array.isArray(item.stats) ? item.stats.filter(isObject) : [];
          for (const stat of stats) {
            statCheckCount++;
            const statName = catalog.itemStats[Number(stat.stat)];
            const match = computed.find((c) => c.stat === statName);
            expect(match, `${file}:${defId}.${statName} — not produced by scaledValores`).toBeDefined();
            const effective = Number(stat.effective);
            const residual = Math.abs((match?.valor ?? Number.NaN) - effective);
            expect(residual, `${file}:${defId}.${statName} — got ${match?.valor} want ${effective}`).toBeLessThanOrEqual(1e-6);
          }
        }
      });
    }

    it('the item-count and stat-check floors are non-zero (anti-vacuity)', () => {
      expect(equippedItemCount).toBeGreaterThan(0);
      expect(statCheckCount).toBeGreaterThan(0);
    });
  });

  it('the legacy gale-*/brenna-*/dara-* fixtures are NOT in this corpus (different exporter version, no birth_stats)', () => {
    const legacyPrefixes = ['gale-', 'brenna-', 'dara-'];
    for (const file of DEC01_FIXTURES) {
      expect(legacyPrefixes.some((prefix) => file.startsWith(prefix)), file).toBe(false);
    }
  });
});
