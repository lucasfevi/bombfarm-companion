/**
 * The 2026-08-28 damage patch, pinned against the capture that witnesses it.
 *
 * Two terms landed together: weapons gained a flat ×5 (`itens.arma_dmg_mult`), and the Dano
 * ladder gained a step every 50 item levels (`itens.dmg_step_niveis`). Only the first has a
 * committed witness — every item on this capture is level 10, where the step is 1 — so the
 * step's own assertion below reads the catalog ladder rather than a save, and says so.
 */
import { describe, expect, it } from 'vitest';
import catalog from '@bombfarm/domain/data/catalog.json';
import { composeSheetFromBirth } from '@bombfarm/domain/birth-sheet';
import { scaledValores } from '@bombfarm/domain/gear';
import { inferSpentPoints } from '@bombfarm/domain/point-inference';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { extractHero, loadFixtureJson, treeTotalsFromSave } from './helpers/sheet-math-fixtures';

const FILE = 'save-20260828-4heroes-postpatch.json';
const data = loadFixtureJson(FILE);
const tree = treeTotalsFromSave((data as { skills: { totals: Record<string, unknown> } }).skills.totals);
const heroes = (data as { heroes: Array<{ name: string }> }).heroes;

type SaveItem = {
  def_id: string;
  level: number;
  rarity: number;
  upgrade: number;
  stats: Array<{ stat: number; value: number; effective: number }>;
};
const items = (data as { items: SaveItem[] }).items;
const DMG_STAT = catalog.itemStats.indexOf('dmg');

describe('the 2026-08-28 damage patch — the capture agrees with the catalog', () => {
  it('every equipped weapon carries five times the flat ladder, as the game exports it', () => {
    const weapons = items.filter((i) => i.def_id.endsWith('_arma') && i.stats.length > 0);
    expect(weapons.length, 'the capture must carry at least one weapon or this is vacuous').toBeGreaterThan(0);
    for (const weapon of weapons) {
      const dmg = weapon.stats.find((s) => s.stat === DMG_STAT);
      expect(dmg, `${weapon.def_id} must roll Dano`).toBeDefined();
      const flat = catalog.statBase.dmg * (catalog.dmgNivelMult as Record<string, number>)[String(weapon.level)];
      expect(dmg!.value, `${weapon.def_id} L${weapon.level}`).toBeCloseTo(flat * catalog.armaDmgMult, 9);
    }
  });

  it("every item's own exported rolls are what scaledValores derives, stat for stat", () => {
    let compared = 0;
    for (const item of items) {
      if (!Array.isArray(item.stats) || item.stats.length === 0) continue;
      const derived = scaledValores(item.def_id, item.rarity, item.level, item.upgrade);
      if (derived.length === 0) continue;
      for (const stat of item.stats) {
        const name = catalog.itemStats[stat.stat];
        const match = derived.find((d) => d.stat === name);
        expect(match, `${item.def_id} ${name}`).toBeDefined();
        expect(match!.valor, `${item.def_id} L${item.level} +${item.upgrade} ${name}`).toBeCloseTo(
          stat.effective,
          9,
        );
        compared += 1;
      }
    }
    expect(compared, 'no stat was compared — the sweep found nothing').toBeGreaterThan(0);
  });

  it.each(heroes.map((h) => h.name))(
    '%s inverts with no issue and recomposes to the stats the game exported',
    (name) => {
      const hero = extractHero(data, name);
      expect(hero.birth, `${name} must carry birth_stats`).toBeDefined();
      const input = {
        birth: hero.birth!,
        level: hero.level,
        stars: hero.stars,
        sheetOther: hero.sheetOther,
        loadout: hero.loadout,
        tree,
      };
      const inferred = inferSpentPoints({ ...input, sheet: hero.sheet, statPointsAvailable: hero.statPointsAvailable });
      expect(inferred.issues, `${name} inversion issues`).toEqual([]);
      const composed = composeSheetFromBirth({ ...input, pts: inferred.pts });
      for (const key of SHEET_KEYS) {
        expect(Math.abs(hero.sheet[key] - composed[key]), `${name} ${key}`).toBeLessThanOrEqual(1e-6);
      }
    },
  );

  it('the Dano ladder steps every 50 levels — catalog-only, no capture reaches past level 10', () => {
    const ladder = catalog.dmgNivelMult as Record<string, number>;
    for (const level of catalog.levels) {
      const expected = (level / 10) * (1 + Math.floor(level / 50));
      expect(ladder[String(level)], `dmgNivelMult[${level}]`).toBeCloseTo(expected, 9);
    }
    expect(Math.max(...items.map((i) => i.level)), 'a capture above level 10 would witness the step directly').toBe(10);
  });
});
