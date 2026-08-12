/* QUARANTINED (catalog v4, 2026-08-11): the assertions below are anchored to in-game
 * captures taken under the pre-v4 balance, on an account that has since been wiped —
 * they cannot be re-baselined without replacing game observations with our own output.
 * Un-skip once a post-update save export lands; `inferSpentPoints`' nonIntegerPoints
 * residual then also decides the open nv50+ Dano question (see gear/catalog.ts
 * composeAttack). Do NOT edit the numbers to make these pass. */
/**
 * `gameSheetView` (`sheet-view.ts`) — the game's display-time clamp (`STAT_CAPS.critChance`
 * /.cdr), applied AFTER `composeSheetFromBirth` rather than inside it. `SaveFile_BombFarm.json`
 * is a real export from an account with all three keystones (Glass Cannon, Tempo Dobrado,
 * Abisso) simultaneously and is the ground truth for both this file and
 * `keystone-sheet-corrections.test.ts` — the hero list / point vectors below are duplicated
 * from that file rather than imported, so this file stays a standalone regression check on the
 * new capping seam without perturbing that file's own assertions (out of scope per the task
 * brief: "do not touch ... the keystone sheet math").
 */
import { describe, expect, it } from 'vitest';
import { composeSheetFromBirth } from '@bombfarm/domain/birth-sheet';
import { gameSheetView, capSheetValue } from '@bombfarm/domain/sheet-view';
import { peelSheetStages } from '@bombfarm/domain/sheet-stages';
import { peelSheetSources } from '@bombfarm/domain/sheet-peel';
import { STAT_CAPS } from '@bombfarm/domain/model';
import { SHEET_KEYS, ZERO_PTS, type SheetKey } from '@bombfarm/domain/planner-constants';
import { extractHero, loadFixtureJson, treeTotalsFromSave } from './helpers/sheet-math-fixtures';

const FIXTURE = 'SaveFile_BombFarm.json';

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

const ALL_HEROES: readonly (readonly [string, number, Record<SheetKey, number>])[] = [
  ...LEVELED.map(([name, level, expected]) => [name, level, toPts(expected)] as const),
  ...LEVEL_ONES.map((name) => [name, 1, { ...ZERO_PTS(), attack: 1 }] as const),
];

describe.skip('gameSheetView(composeSheetFromBirth(...)) === exported stats, exactly (SaveFile_BombFarm.json)', () => {
  const raw = loadFixtureJson(FIXTURE);
  const totals = (raw.skills as { totals: Record<string, unknown> }).totals;
  const tree = treeTotalsFromSave(totals);

  for (const [name, level, pts] of ALL_HEROES) {
    it(`${name} L${level}`, () => {
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
      const viewed = gameSheetView(composed);
      for (const key of SHEET_KEYS) {
        expect(
          Math.abs(viewed[key] - hero.sheet[key]),
          `${name}.${key}: got ${viewed[key]} want ${hero.sheet[key]}`,
        ).toBeLessThanOrEqual(1e-6);
      }
    });
  }
});

describe('peelSheetStages: sum identity on total holds, and cappedTotal matches gameSheetView', () => {
  const raw = loadFixtureJson(FIXTURE);
  const totals = (raw.skills as { totals: Record<string, unknown> }).totals;
  const tree = treeTotalsFromSave(totals);

  for (const [name, level, pts] of ALL_HEROES) {
    it(`${name} L${level}`, () => {
      const hero = extractHero(raw, name, level);
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
      const viewed = gameSheetView(composed);
      const peeled = peelSheetStages(input);

      for (const key of SHEET_KEYS) {
        const row = peeled[key];
        const summed =
          row.birth + row.deltaLevel + row.deltaStars + row.deltaAbility + row.deltaGear + row.deltaPoints + row.deltaTree;
        expect(summed, `${name}.${key}: Δs must sum to the UNCAPPED total`).toBeCloseTo(row.total, 6);
        expect(row.total, `${name}.${key}: total must still equal composeSheetFromBirth`).toBeCloseTo(
          composed[key],
          9,
        );
        expect(row.cappedTotal, `${name}.${key}: cappedTotal must equal total + deltaCap`).toBeCloseTo(
          row.total + row.deltaCap,
          9,
        );
        expect(row.cappedTotal, `${name}.${key}: cappedTotal must match gameSheetView`).toBeCloseTo(
          viewed[key],
          9,
        );
      }
    });
  }
});

/**
 * `peelSheetSources` predates the keystone sheet-math correction and does not (yet) model
 * Glass Cannon's energy ×0.5 — a real gap, but a keystone-modelling one, and out of scope here
 * ("do not touch ... the keystone sheet math"). Using `SaveFile_BombFarm.json` (all three
 * keystones, on every hero) would fail on that pre-existing gap for reasons unrelated to
 * capping. This block instead uses `save-20260801-crit-dmg-tree.json` (keystone-free — its
 * `crit_dmg_mult` is `1` and `skills.totals.keystones` is empty), the same fixture
 * `sheet-peel.test.ts`'s own AC-10 suite already trusts, with a synthetic point allocation
 * (no real save to solve against; this block checks internal consistency of the sum + cap
 * mechanism, not save fidelity — that's `gameSheetView`'s own describe block above).
 */
describe('peelSheetSources: four-line sum identity holds; a display-capped sum matches gameSheetView', () => {
  const raw = loadFixtureJson('save-20260801-crit-dmg-tree.json');
  const totals = (raw.skills as { totals: Record<string, unknown> }).totals;
  const tree = treeTotalsFromSave(totals);
  const samplePts: Record<SheetKey, number> = {
    ...ZERO_PTS(),
    attack: 10,
    energy: 10,
    speed: 10,
    critChance: 10,
    critDmg: 10,
    penetration: 10,
    cdr: 10,
    luck: 10,
  };
  const cases: readonly (readonly [string, number])[] = [
    ['Bram', 54],
    ['Bellatrix', 62],
    ['Torin', 51],
    ['Rowan', 32],
    ['Zane', 43],
    ['Vera', 27],
    ['Korin', 50],
  ];

  for (const [name, level] of cases) {
    it(`${name} L${level}`, () => {
      const hero = extractHero(raw, name, level);
      const input = {
        birth: hero.birth!,
        level: hero.level,
        stars: hero.stars,
        sheetOther: hero.sheetOther,
        loadout: hero.loadout,
        pts: samplePts,
        tree,
      };
      const composed = composeSheetFromBirth(input);
      const viewed = gameSheetView(composed);
      const lines = peelSheetSources(input);

      for (const key of SHEET_KEYS) {
        const sum = lines[key].hero + lines[key].gear + lines[key].ability + lines[key].skillTree;
        expect(sum, `${name}.${key}: AC-10 sum identity`).toBeCloseTo(composed[key], 6);
        expect(capSheetValue(key, sum), `${name}.${key}: capped sum must match gameSheetView`).toBeCloseTo(
          viewed[key],
          6,
        );
      }
    });
  }
});

describe('deltaCap is exactly 0 under the caps, and negative only for heroes over them', () => {
  const raw = loadFixtureJson(FIXTURE);
  const totals = (raw.skills as { totals: Record<string, unknown> }).totals;
  const tree = treeTotalsFromSave(totals);

  for (const [name, level, pts] of ALL_HEROES) {
    it(`${name} L${level}`, () => {
      const hero = extractHero(raw, name, level);
      const input = {
        birth: hero.birth!,
        level: hero.level,
        stars: hero.stars,
        sheetOther: hero.sheetOther,
        loadout: hero.loadout,
        pts,
        tree,
      };
      const peeled = peelSheetStages(input);
      for (const key of SHEET_KEYS) {
        const row = peeled[key];
        const cap = key === 'critChance' ? STAT_CAPS.critChance : key === 'cdr' ? STAT_CAPS.cdr : null;
        if (cap !== null && row.total > cap) {
          expect(row.deltaCap, `${name}.${key}: over cap must carry a negative deltaCap`).toBeLessThan(0);
        } else {
          expect(row.deltaCap, `${name}.${key}: under (or at) the cap must carry exactly 0`).toBe(0);
        }
      }
    });
  }
});

describe.skip('penetration is never clamped by gameSheetView (BSPW4-09) — Jon/Tiny/Isolde exceed 100 in the export', () => {
  const raw = loadFixtureJson(FIXTURE);
  const totals = (raw.skills as { totals: Record<string, unknown> }).totals;
  const tree = treeTotalsFromSave(totals);
  const cases: readonly (readonly [string, number, Record<SheetKey, number>])[] = [
    ['Jon', 100, toPts({ attack: 55, critDmg: 45, speed: 0, energy: 0 })],
    ['Tiny', 85, toPts({ attack: 45, critDmg: 40, speed: 0, energy: 0 })],
    ['Isolde', 81, toPts({ attack: 72, critDmg: 7, speed: 0, energy: 2 })],
  ];

  for (const [name, level, pts] of cases) {
    it(`${name} L${level}: exported penetration exceeds 100 and gameSheetView leaves it untouched`, () => {
      const hero = extractHero(raw, name, level);
      expect(hero.sheet.penetration, `${name}: fixture must exceed the 100 penetration "cap"`).toBeGreaterThan(100);

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
      const viewed = gameSheetView(composed);
      expect(viewed.penetration, `${name}: gameSheetView must not clamp penetration`).toBeCloseTo(
        composed.penetration,
        9,
      );
      expect(viewed.penetration).toBeGreaterThan(100);
      expect(Math.abs(viewed.penetration - hero.sheet.penetration)).toBeLessThanOrEqual(1e-6);
    });
  }
});
