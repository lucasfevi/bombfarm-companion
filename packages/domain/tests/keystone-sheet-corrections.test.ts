/* QUARANTINED (catalog v4, 2026-08-11): the assertions below are anchored to in-game
 * captures taken under the pre-v4 balance, on an account that has since been wiped —
 * they cannot be re-baselined without replacing game observations with our own output.
 * Un-skip once a post-update save export lands; `inferSpentPoints`' nonIntegerPoints
 * residual then also decides the open nv50+ Dano question (see gear/catalog.ts
 * composeAttack). Do NOT edit the numbers to make these pass. */
/**
 * Keystone sheet-math correction regression test — `SaveFile_BombFarm.json` carries all three
 * verified keystone corrections simultaneously: Glass Cannon (C15, `crit_dmg_mult: 2`), Tempo
 * Dobrado (V15, speed ×1.33333), and Abisso (D15) on top. Before this correction, all three
 * were modelled as combat multipliers instead of sheet-layer factors, which made the
 * recomposed sheet disagree with the game's exported sheet and corrupted `inferSpentPoints`
 * (e.g. recovering more points than the hero's level allows).
 *
 * For every hero in the save: `composeSheetFromBirth` must reproduce the exported `stats`
 * block exactly (same tolerance style as `sheet-math-fixtures.test.ts`), and
 * `inferSpentPoints` must recover a vector summing to exactly `level - stat_points_available`
 * with zero issues. The expected per-hero point vectors below are given (attack / critDmg /
 * speed / energy — the only nonzero stats in this save); every hero has
 * `stat_points_available: 0`, so the recovered vector must sum to exactly `level`.
 *
 * `composeSheetFromBirth` is deliberately UNCAPPED (see its doc comment in `birth-sheet.ts`) —
 * several heroes in this save reach `STAT_CAPS.critChance`/`.cdr` from ability+gear alone, and
 * the game clamps its EXPORTED sheet at those caps while the model does not, so the cap is
 * applied HERE, at comparison time, not inside the model. Clamping inside
 * `composeSheetFromBirth` would desync it from `peelSheetStages` (`sheet-stages.ts`), which
 * independently recomputes the same total for the Stats panel's telescoping columns and must
 * keep summing to it exactly — display-time capping is a shared concern for both consumers,
 * not a model concern (a future `gameSheetView()` helper is the intended home for it).
 */
import { describe, expect, it } from 'vitest';
import { composeSheetFromBirth } from '@bombfarm/domain/birth-sheet';
import { inferSpentPoints } from '@bombfarm/domain/point-inference';
import { STAT_CAPS } from '@bombfarm/domain/model';
import { peelSheetStages } from '@bombfarm/domain/sheet-stages';
import { SHEET_KEYS, ZERO_PTS, type SheetKey } from '@bombfarm/domain/planner-constants';
import type { SheetStats } from '@bombfarm/domain/gear';
import { extractHero, loadFixtureJson, treeTotalsFromSave } from './helpers/sheet-math-fixtures';

const FIXTURE = 'SaveFile_BombFarm.json';

/** Mirrors the game's own sheet clamp (`STAT_CAPS.critChance`/`.cdr`) — applied at comparison
 * time only, never inside the model (see the file-header comment). Penetration is excluded on
 * purpose — the game does NOT clamp sheet penetration (BSPW4-09). */
function gameSheetCap(sheet: SheetStats): SheetStats {
  return {
    ...sheet,
    critChance: Math.min(sheet.critChance, STAT_CAPS.critChance),
    cdr: Math.min(sheet.cdr, STAT_CAPS.cdr),
  };
}

type ExpectedPts = { attack: number; critDmg: number; speed: number; energy: number };

const LEVELED: readonly (readonly [string, number, ExpectedPts])[] = [
  ['Bram', 74, { attack: 45, critDmg: 24, speed: 0, energy: 5 }],
  ['Bellatrix', 100, { attack: 42, critDmg: 58, speed: 0, energy: 0 }],
  ['Jon', 100, { attack: 55, critDmg: 45, speed: 0, energy: 0 }],
  ['Sora', 90, { attack: 57, critDmg: 33, speed: 0, energy: 0 }],
  ['Bryn', 91, { attack: 50, critDmg: 41, speed: 0, energy: 0 }],
  ['Perrin', 64, { attack: 45, critDmg: 19, speed: 0, energy: 0 }],
  ['Minato', 89, { attack: 47, critDmg: 42, speed: 0, energy: 0 }],
  ['Tiny', 85, { attack: 45, critDmg: 40, speed: 0, energy: 0 }],
  ['Isolde', 81, { attack: 72, critDmg: 7, speed: 0, energy: 2 }],
  ['Hale', 81, { attack: 81, critDmg: 0, speed: 0, energy: 0 }],
];

const LEVEL_ONES = ['Fenn', 'Wren', 'Gale', 'Nyx', 'Vera', 'Cael', 'Edda', 'Sora'] as const;

function toPts(expected: ExpectedPts): Record<SheetKey, number> {
  return {
    ...ZERO_PTS(),
    attack: expected.attack,
    critDmg: expected.critDmg,
    speed: expected.speed,
    energy: expected.energy,
  };
}

describe.skip('keystone sheet-math correction — SaveFile_BombFarm.json (Glass Cannon + Tempo Dobrado + Abisso)', () => {
  const raw = loadFixtureJson(FIXTURE);
  const totals = (raw.skills as { totals: Record<string, unknown> }).totals;
  const tree = treeTotalsFromSave(totals);

  it('the save actually carries all three keystones (sanity check on the fixture itself)', () => {
    expect(tree.critDmgMult).toBe(2);
    expect(tree.glassCannon).toBe(true);
    expect(tree.tempoDobrado).toBe(true);
  });

  for (const [name, level, expected] of LEVELED) {
    it(`${name} L${level}: composes exactly and infers the documented point vector`, () => {
      const hero = extractHero(raw, name, level);
      expect(hero.birth, `${name} must carry birth_stats`).toBeDefined();
      expect(hero.statPointsAvailable).toBe(0);

      const pts = toPts(expected);
      const composed = composeSheetFromBirth({
        birth: hero.birth!,
        level: hero.level,
        stars: hero.stars,
        sheetOther: hero.sheetOther,
        loadout: hero.loadout,
        pts,
        tree,
      });
      const cappedComposed = gameSheetCap(composed);
      for (const key of SHEET_KEYS) {
        expect(Math.abs(cappedComposed[key] - hero.sheet[key]), `${name}.${key}: got ${cappedComposed[key]} want ${hero.sheet[key]}`).toBeLessThanOrEqual(1e-6);
      }

      const inferred = inferSpentPoints({
        birth: hero.birth!,
        level: hero.level,
        stars: hero.stars,
        sheetOther: hero.sheetOther,
        loadout: hero.loadout,
        tree,
        sheet: hero.sheet,
        statPointsAvailable: hero.statPointsAvailable,
      });
      expect(inferred.issues, `${name}: ${JSON.stringify(inferred.issues)}`).toEqual([]);
      expect(inferred.pts.attack + 0, `${name}.attack`).toBe(expected.attack);
      expect(inferred.pts.critDmg + 0, `${name}.critDmg`).toBe(expected.critDmg);
      expect(inferred.pts.speed + 0, `${name}.speed`).toBe(expected.speed);
      expect(inferred.pts.energy + 0, `${name}.energy`).toBe(expected.energy);

      const recovered = SHEET_KEYS.reduce((sum, key) => sum + inferred.pts[key], 0);
      expect(recovered, `${name}: recovered vs level - statPointsAvailable`).toBe(
        hero.level - hero.statPointsAvailable,
      );
    });
  }

  for (const name of LEVEL_ONES) {
    it(`${name} L1: 1 attack point, zero issues, composes exactly`, () => {
      const hero = extractHero(raw, name, 1);
      expect(hero.birth, `${name} must carry birth_stats`).toBeDefined();
      expect(hero.statPointsAvailable).toBe(0);

      const pts = { ...ZERO_PTS(), attack: 1 };
      const composed = composeSheetFromBirth({
        birth: hero.birth!,
        level: hero.level,
        stars: hero.stars,
        sheetOther: hero.sheetOther,
        loadout: hero.loadout,
        pts,
        tree,
      });
      const cappedComposed = gameSheetCap(composed);
      for (const key of SHEET_KEYS) {
        expect(Math.abs(cappedComposed[key] - hero.sheet[key]), `${name}.${key}: got ${cappedComposed[key]} want ${hero.sheet[key]}`).toBeLessThanOrEqual(1e-6);
      }

      const inferred = inferSpentPoints({
        birth: hero.birth!,
        level: hero.level,
        stars: hero.stars,
        sheetOther: hero.sheetOther,
        loadout: hero.loadout,
        tree,
        sheet: hero.sheet,
        statPointsAvailable: hero.statPointsAvailable,
      });
      expect(inferred.issues, `${name}: ${JSON.stringify(inferred.issues)}`).toEqual([]);
      expect(inferred.pts.attack, `${name}.attack`).toBe(1);

      const recovered = SHEET_KEYS.reduce((sum, key) => sum + inferred.pts[key], 0);
      expect(recovered, `${name}: recovered vs level - statPointsAvailable`).toBe(
        hero.level - hero.statPointsAvailable,
      );
    });
  }
});

const ALL_HEROES: readonly (readonly [string, number, Record<SheetKey, number>])[] = [
  ...LEVELED.map(([name, level, expected]) => [name, level, toPts(expected)] as const),
  ...LEVEL_ONES.map((name) => [name, 1, { ...ZERO_PTS(), attack: 1 }] as const),
];

/**
 * Regression guard for exactly the bug the STAT_CAPS clamp attempt introduced: `composeSheetFromBirth`
 * and `peelSheetStages` (`sheet-stages.ts`) independently run the same
 * `nakedFromBirth` → `applyPoints`/`applyGear` → `applySkillTree` steps — one to produce the Total
 * the Planner stores, the other to produce the telescoping Birth+Δ columns the Stats panel
 * renders (`birth + Σdelta = total`). They MUST agree on every stat for every hero, including
 * the keystone-account heroes that sit at `STAT_CAPS` — nothing else in the suite guarded this,
 * and it broke silently (composed capped, peeled uncapped) the first time a cap was added to
 * only one of the two call sites.
 */
describe('composeSheetFromBirth agrees with peelSheetStages on every stat (SaveFile_BombFarm.json)', () => {
  const raw = loadFixtureJson(FIXTURE);
  const totals = (raw.skills as { totals: Record<string, unknown> }).totals;
  const tree = treeTotalsFromSave(totals);

  for (const [name, level, pts] of ALL_HEROES) {
    it(`${name} L${level}: composeSheetFromBirth total === peelSheetStages total, and stage columns sum to it`, () => {
      const hero = extractHero(raw, name, level);
      expect(hero.birth, `${name} must carry birth_stats`).toBeDefined();

      const input = {
        birth: hero.birth!,
        level: hero.level,
        stars: hero.stars,
        sheetOther: hero.sheetOther,
        loadout: hero.loadout,
        pts,
        tree,
      };
      const composed = composeSheetFromBirth(input);
      const peeled = peelSheetStages(input);

      for (const key of SHEET_KEYS) {
        expect(peeled[key].total, `${name}.${key}: peelSheetStages total vs composeSheetFromBirth`).toBeCloseTo(
          composed[key],
          9,
        );
        const summed =
          peeled[key].birth +
          peeled[key].deltaLevel +
          peeled[key].deltaStars +
          peeled[key].deltaAbility +
          peeled[key].deltaGear +
          peeled[key].deltaPoints +
          peeled[key].deltaTree;
        expect(summed, `${name}.${key}: stage columns must sum to total`).toBeCloseTo(peeled[key].total, 6);
      }
    });
  }
});
