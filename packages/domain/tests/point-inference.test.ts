/**
 * BSPW4-03 (AC-19…AC-27) — integer spent-point recovery from the sheet.
 */
import { describe, expect, it } from 'vitest';
import { composeSheetFromBirth, type BirthStats, type TreeSheetTotals } from '@bombfarm/domain/birth-sheet';
import {
  inferSpentPoints,
  POINT_INFERENCE_EPS,
  type InferSpentPointsInput,
} from '@bombfarm/domain/point-inference';
import { STAT_CAPS } from '@bombfarm/domain/model';
import { emptyLoadout, emptySheetOther, type Loadout, type SheetOtherPct } from '@bombfarm/domain/gear';
import { SHEET_KEYS, ZERO_PTS, type SheetKey } from '@bombfarm/domain/planner-constants';
import { extractHero, loadFixtureJson, treeTotalsFromSave } from './helpers/sheet-math-fixtures';

const WAVE0_ZERO_TREE: TreeSheetTotals = {
  danoStatic: 1,
  energyPct: 0,
  speedPct: 0,
  critChancePct: 0,
  critDmgPct: 0,
  luckFlatPct: 0,
  critDmgMult: 1,
};

const FIXTURES = [
  { file: 'bellatrix-02-pts-each-1.json', names: [
    ['Bram', 49], ['Bellatrix', 59], ['Torin', 45], ['Rowan', 24], ['Zane', 30], ['Vera', 17],
    ['Korin', 21], ['Korin', 2], ['Nyx', 4], ['Mira', 1], ['Finn', 1],
  ] as const },
  { file: 'save-20260801-crit-dmg-tree.json', names: [
    ['Bram', 54], ['Bellatrix', 62], ['Torin', 51], ['Rowan', 32], ['Zane', 43], ['Vera', 27],
    ['Korin', 50], ['Orin', 23], ['Kira', 5], ['Maeve', 6],
  ] as const },
];

function inputFor(hero: ReturnType<typeof extractHero>, tree: TreeSheetTotals): InferSpentPointsInput {
  return {
    birth: hero.birth!,
    level: hero.level,
    stars: hero.stars,
    sheetOther: hero.sheetOther,
    loadout: hero.loadout,
    tree,
    sheet: hero.sheet,
    statPointsAvailable: hero.statPointsAvailable,
  };
}

describe('inferSpentPoints — AC-19, AC-20, AC-21, AC-22: 21 hero-instances', () => {
  let worstResidual = 0;
  let worstDescription = '';

  for (const { file, names } of FIXTURES) {
    const raw = loadFixtureJson(file);
    const tree = treeTotalsFromSave((raw.skills as { totals: Record<string, unknown> }).totals);

    for (const [name, level] of names) {
      it(`${file} :: ${name} L${level} — integer pts, zero issues, budget reconciles`, () => {
        const hero = extractHero(raw, name, level);
        const result = inferSpentPoints(inputFor(hero, tree));

        expect(result.issues, JSON.stringify(result.issues)).toEqual([]);

        const budget = hero.level - hero.statPointsAvailable;
        const recovered = SHEET_KEYS.reduce((sum, key) => sum + result.pts[key], 0);
        expect(recovered).toBe(budget); // AC-22 — toBe, not toBeCloseTo (L-08)

        for (const key of SHEET_KEYS) {
          expect(Number.isInteger(result.pts[key]), `${name}.${key}`).toBe(true);
        }
      });
    }
  }

  it('AC-21: re-deriving the raw (pre-round) solve keeps the worst residual below 1e-9', () => {
    // Re-run every instance and track the worst |raw - round(raw)| via the nonIntegerPoints
    // issue channel (empty when residual <= EPS, but we want the true worst even under it —
    // so recompute pts twice: once via inferSpentPoints (rounded), once by comparing against
    // composeSheetFromBirth's own reproduction of the observed sheet at the rounded vector).
    for (const { file, names } of FIXTURES) {
      const raw = loadFixtureJson(file);
      const tree = treeTotalsFromSave((raw.skills as { totals: Record<string, unknown> }).totals);
      for (const [name, level] of names) {
        const hero = extractHero(raw, name, level);
        const result = inferSpentPoints(inputFor(hero, tree));
        const recomposed = composeSheetFromBirth({
          birth: hero.birth!,
          level: hero.level,
          stars: hero.stars,
          sheetOther: hero.sheetOther,
          loadout: hero.loadout,
          pts: result.pts,
          tree,
        });
        for (const key of SHEET_KEYS) {
          const residual = Math.abs(recomposed[key] - hero.sheet[key]);
          if (residual > worstResidual) {
            worstResidual = residual;
            worstDescription = `${file}:${name}.${key}`;
          }
        }
      }
    }
    expect(worstResidual, worstDescription).toBeLessThan(1e-9);
  });
});

describe('inferSpentPoints — AC-23…AC-27: degradation paths on a hand-mutated real fixture hero', () => {
  const raw = loadFixtureJson('save-20260801-crit-dmg-tree.json');
  const tree = treeTotalsFromSave((raw.skills as { totals: Record<string, unknown> }).totals);
  const bellatrix = extractHero(raw, 'Bellatrix', 62);

  it('AC-23: a solved value that rounds negative is clamped to 0 and emits negativePoints', () => {
    // Nudge attack far below what 0 points would produce (23 real points spent).
    const mutatedSheet = { ...bellatrix.sheet, attack: bellatrix.sheet.attack - 5000 };
    const result = inferSpentPoints(inputFor({ ...bellatrix, sheet: mutatedSheet }, tree));
    expect(result.pts.attack).toBe(0);
    const negativeIssue = result.issues.find(
      (issue) => issue.kind === 'negativePoints' && issue.key === 'attack',
    );
    expect(negativeIssue, JSON.stringify(result.issues)).toBeDefined();
  });

  it('AC-24: an out-of-tolerance residual emits nonIntegerPoints and KEEPS the rounded value', () => {
    // Nudge attack by +0.5 raw units — a small fraction of one point's worth (~34), so the
    // solved value stays close to 23 but its residual clears POINT_INFERENCE_EPS (1e-6).
    const mutatedSheet = { ...bellatrix.sheet, attack: bellatrix.sheet.attack + 0.5 };
    const result = inferSpentPoints(inputFor({ ...bellatrix, sheet: mutatedSheet }, tree));
    const issue = result.issues.find(
      (candidate) => candidate.kind === 'nonIntegerPoints' && candidate.key === 'attack',
    );
    expect(issue, JSON.stringify(result.issues)).toBeDefined();
    if (issue?.kind === 'nonIntegerPoints') {
      expect(issue.residual).toBeGreaterThan(POINT_INFERENCE_EPS);
    }
    expect(result.pts.attack).toBe(23); // rounded value still returned, not discarded
  });

  it('AC-25: a budget mismatch emits the signed difference and returns the vector unmodified', () => {
    const mutated = { ...bellatrix, statPointsAvailable: bellatrix.statPointsAvailable - 5 };
    const clean = inferSpentPoints(inputFor(bellatrix, tree));
    const mismatched = inferSpentPoints(inputFor(mutated, tree));

    // Same sheet math -> same recovered vector; only the reconciliation against the (wrong)
    // reported budget differs. No scaling, no redistribution.
    for (const key of SHEET_KEYS) {
      expect(mismatched.pts[key], key).toBe(clean.pts[key]);
    }
    const issue = mismatched.issues.find((candidate) => candidate.kind === 'budgetMismatch');
    expect(issue, JSON.stringify(mismatched.issues)).toBeDefined();
    if (issue?.kind === 'budgetMismatch') {
      const recovered = SHEET_KEYS.reduce((sum, key) => sum + mismatched.pts[key], 0);
      const budget = mutated.level - mutated.statPointsAvailable;
      expect(issue.recovered).toBe(recovered);
      expect(issue.budget).toBe(budget);
      expect(issue.difference).toBe(recovered - budget);
    }
  });

  it('AC-26: saturatedStats names crit chance / cdr when the sheet sits at STAT_CAPS', () => {
    const atCritCap = {
      ...bellatrix,
      sheet: { ...bellatrix.sheet, critChance: STAT_CAPS.critChance },
      statPointsAvailable: bellatrix.statPointsAvailable - 5,
    };
    const result = inferSpentPoints(inputFor(atCritCap, tree));
    const issue = result.issues.find((candidate) => candidate.kind === 'budgetMismatch');
    expect(issue, JSON.stringify(result.issues)).toBeDefined();
    if (issue?.kind === 'budgetMismatch') {
      expect(issue.saturatedStats).toContain('critChance');
      expect(issue.saturatedStats).not.toContain('cdr');
    }

    const atCdrCap = {
      ...bellatrix,
      sheet: { ...bellatrix.sheet, cdr: STAT_CAPS.cdr },
      statPointsAvailable: bellatrix.statPointsAvailable - 5,
    };
    const resultCdr = inferSpentPoints(inputFor(atCdrCap, tree));
    const issueCdr = resultCdr.issues.find((candidate) => candidate.kind === 'budgetMismatch');
    expect(issueCdr, JSON.stringify(resultCdr.issues)).toBeDefined();
    if (issueCdr?.kind === 'budgetMismatch') {
      expect(issueCdr.saturatedStats).toContain('cdr');
    }
  });

  it('AC-26 (negative case): saturatedStats is empty when neither cap is reached', () => {
    const mutated = { ...bellatrix, statPointsAvailable: bellatrix.statPointsAvailable - 5 };
    const result = inferSpentPoints(inputFor(mutated, tree));
    const issue = result.issues.find((candidate) => candidate.kind === 'budgetMismatch');
    if (issue?.kind === 'budgetMismatch') {
      expect(issue.saturatedStats).toEqual([]);
    }
  });

  it('AC-27: every issue above is driven from a mutated copy of the REAL Bellatrix fixture hero', () => {
    // Guard against a future edit silently swapping in a synthetic sheet: the base fixture
    // hero must still be the real, unmutated save extraction with a nonzero attack roll.
    expect(bellatrix.sheet.attack).toBeGreaterThan(0);
    expect(bellatrix.birth?.attack).toBeGreaterThan(0);
  });
});

describe('inferSpentPoints — the Luck branch (hand-built, since no fixture hero has Luck points)', () => {
  it('recovers a nonzero pts.luck and includes it in the budget total', () => {
    const birth: BirthStats = {
      attack: 100, energy: 200, speed: 50, critChance: 8, critDmg: 60, penetration: 3, cdr: 2, luck: 5,
    };
    const sheetOther: SheetOtherPct = emptySheetOther();
    const loadout: Loadout = emptyLoadout();
    const pts: Record<SheetKey, number> = { ...ZERO_PTS(), attack: 2, luck: 7 };
    const sheet = composeSheetFromBirth({
      birth,
      level: 10,
      stars: 1,
      sheetOther,
      loadout,
      pts,
      tree: WAVE0_ZERO_TREE,
    });
    const result = inferSpentPoints({
      birth,
      level: 10,
      stars: 1,
      sheetOther,
      loadout,
      tree: WAVE0_ZERO_TREE,
      sheet,
      statPointsAvailable: 10 - 9, // budget = 9 = 2 (attack) + 7 (luck)
    });
    expect(result.issues).toEqual([]);
    expect(result.pts.luck).toBe(7);
    expect(result.pts.attack).toBe(2);
    const recovered = SHEET_KEYS.reduce((sum, key) => sum + result.pts[key], 0);
    expect(recovered).toBe(9);
  });
});
