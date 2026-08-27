/**
 * MP5 F1 (`AD-071`) — the point round-trip invariant, replacing the deleted before/after
 * point-spend fixture family (`brenna-06/07`, `gale-02/03`, `vera-02/03`; all unreproducible
 * from a single post-wipe snapshot — `stat_points_available` is `0` on every corpus hero).
 *
 * **Why this is not circular (`AD-068`'s ground-truth rule, satisfied):** the game observes
 * each hero's `stats` object directly and writes it into the export. That is a game
 * observation, not our output — `@bombfarm/domain` has to *land on it*. The forward chain
 * (`nakedFromBirth` → `applyPoints` → `applySkillTree`, wired here as `composeSheetFromBirth`)
 * consumes `inferSpentPoints`'s recovered point split only as an intermediate; the split is
 * never the assertion target. The assertion target — the expected value in every comparison
 * below — is `saveSheetUnits(hero.stats)`, the game's own reading. `AD-068` bans pasting our
 * own model's output in as an expected value; here the expected value is the game's.
 *
 * **The exactness bar (`AD-071`)**: literal bit-exactness (`Object.is`) is measurably
 * unachievable across the board — IEEE-754 association order differs between the game's own
 * accumulation and this forward chain's, producing residuals from ~1e-15 to ~1.4e-12 on most
 * heroes. The bar is therefore four claims, stronger together than either a bare `Object.is`
 * or a bare tolerance: (A) the point split is exact (zero inference issues) for all heroes but
 * one; (D) the one exception is pinned by kind, key and residual bound, not swept under a
 * tolerance; (B) the round trip lands within `SHEET_ABS_TOL` for every issue-free hero; (C) a
 * committed floor of exact (`Object.is`) key comparisons — `critDmg` on every hero, `cdr` on the
 * item-free ones — so the suite keeps a genuinely exact floor and cannot drift into
 * tolerance-only.
 */
import { describe, expect, it } from 'vitest';
import { composeSheetFromBirth } from '@bombfarm/domain/birth-sheet';
import { inferSpentPoints } from '@bombfarm/domain/point-inference';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { expectSheetsClose, extractHero, loadFixtureJson, treeTotalsFromSave } from './helpers/sheet-math-fixtures';

const EXPORT_FILE = 'save-20260823-13heroes-crit-points.json';

/**
 * All 13 heroes of the post-2026-08-23 corpus file — the suite's entire subject set.
 *
 * `save-20260818-12heroes.json` and `save-20260819-respec-crit-cdr.json` are NO LONGER subjects:
 * the 2026-08-23 patch restated both crit-chance ABILITIES in flat points (see the
 * `critChanceFlat` ability kind), and no single model reproduces a capture from either side of
 * that change. They stay committed for the structural suites and for the provenance they carry —
 * the 08-18 file was the whole-roster witness for the percent-of-base revert.
 *
 * The five 2026-08-16/17 captures that stopped being subjects before them have since been retired
 * from the corpus outright. They had been carried for structural coverage that the four
 * current-regime captures now provide, and no suite could still read their sheet arithmetic.
 *
 * This file is the first whole-roster witness for the flat crit-chance ABILITY: every one of the
 * 13 heroes is issue-free with a budget landing exactly on `level`, and three of them carry
 * `olho_clinico` — Minato and Jon at rank 20 with gear, and Perrin at rank 13 with none. Perrin
 * is the discriminating one: gear-free and points-free, his sheet is
 * `6.02142890221474 + 13 × 2 + 6.02142890221474 × 0.08042584275`, so the flat addend, the
 * pool's exclusion of it, and the tree's pre-ability base are all pinned by one hero at once.
 * It is also a crit-DAMAGE witness (Buff S #1 holds `golpe_brutal` 20, landing on a flat
 * `rank × 4` — crit damage is unaffected by any of the crit-chance patches) and, via the four
 * item-free heroes (Rowan/Perrin/Korin and, for cooldown, WB #3), the cleanest tree-only witness
 * in the corpus.
 */
const SUBJECTS: readonly { file: string; name: string; level: number }[] = [
  { file: EXPORT_FILE, name: 'Minato', level: 95 },
  { file: EXPORT_FILE, name: 'Jon', level: 96 },
  { file: EXPORT_FILE, name: 'Bellatrix', level: 106 },
  { file: EXPORT_FILE, name: 'Buff S #1', level: 85 },
  { file: EXPORT_FILE, name: 'WB #2', level: 77 },
  { file: EXPORT_FILE, name: 'WB #1', level: 84 },
  { file: EXPORT_FILE, name: 'Buff L #1', level: 68 },
  { file: EXPORT_FILE, name: 'WB #3', level: 59 },
  { file: EXPORT_FILE, name: 'Buff FL #1', level: 50 },
  { file: EXPORT_FILE, name: 'Manco #2', level: 67 },
  { file: EXPORT_FILE, name: 'Rowan', level: 2 },
  { file: EXPORT_FILE, name: 'Perrin', level: 53 },
  { file: EXPORT_FILE, name: 'Korin', level: 2 },
];

/**
 * All 13 heroes are issue-free; the claims below assert that with no exception carved out, so a
 * regression cannot reintroduce one quietly. The two shapes that would each reintroduce one:
 * modelling crit-damage points as a share of the roll (which left Bellatrix's 2 points solving
 * to 1.8867 before `POINT_GAIN.critDmgFlat` was measured), and modelling Olho Clínico as a share
 * of the roll or as a flat term INSIDE the gear pool — the latter charges the whole +40 to spent
 * crit-chance points and puts Minato and Jon at fractional negatives.
 */

type Subject = (typeof SUBJECTS)[number];

function subjectLabel(s: Subject): string {
  return `${s.file} → ${s.name} L${s.level}`;
}

function prepare(s: Subject) {
  const raw = loadFixtureJson(s.file);
  const hero = extractHero(raw, s.name, s.level);
  const totalsRaw = (raw.skills as Record<string, unknown>).totals as Record<string, unknown>;
  const tree = treeTotalsFromSave(totalsRaw);
  if (!hero.birth) {
    throw new Error(`${subjectLabel(s)}: fixture hero has no usable birth_stats — cannot round-trip`);
  }
  const birth = hero.birth;
  const inference = inferSpentPoints({
    birth,
    level: hero.level,
    stars: hero.stars,
    sheetOther: hero.sheetOther,
    loadout: hero.loadout,
    tree,
    sheet: hero.sheet,
    statPointsAvailable: hero.statPointsAvailable,
  });
  const forward = composeSheetFromBirth({
    birth,
    level: hero.level,
    stars: hero.stars,
    sheetOther: hero.sheetOther,
    loadout: hero.loadout,
    pts: inference.pts,
    tree,
  });
  return { subject: s, hero, forward, inference };
}

const PREPARED = SUBJECTS.map(prepare);

/** The capture's own `skills.totals`, in the units `treeTotalsFromSave` produces — read from the
 *  fixture rather than retyped, so a corpus swap cannot leave a stale literal behind. */
const FIXTURE_TREE = treeTotalsFromSave(
  (loadFixtureJson(EXPORT_FILE).skills as Record<string, unknown>).totals as Record<string, unknown>,
);
const TREE_CRIT_CHANCE_PCT = FIXTURE_TREE.critChancePct;
const TREE_CRIT_DMG_PCT = FIXTURE_TREE.critDmgPct;

describe('point round trip (AD-071) — birth + inferred points + gear + tree reproduces the observed stats', () => {
  it('non-vacuity: iterates exactly 13 heroes and 104 key comparisons', () => {
    expect(SUBJECTS.length, 'expected exactly 13 heroes on the 2026-08-23 capture').toBe(13);
    expect(PREPARED.length).toBe(13);
    const totalComparisons = PREPARED.length * SHEET_KEYS.length;
    expect(totalComparisons, '13 heroes × 8 SHEET_KEYS').toBe(104);
  });

  it('claim A — inferSpentPoints reports zero issues for every hero, with no exception carved out', () => {
    expect(PREPARED.length, 'expected all 13 heroes to be checked').toBe(13);
    for (const p of PREPARED) {
      expect(p.inference.issues, `${subjectLabel(p.subject)} should be issue-free`).toEqual([]);
    }
  });

  it('claim D — Buff S #1 pins crit DAMAGE as flat', () => {
    // Crit damage is unaffected by every crit-chance/CDR patch — it went flat at the 2026-08-13
    // patch and has stayed flat through the three since. This hero's sheet sits exactly
    // `rank x 4` planner points above its roll, plus the tree's own flat `crit_dmg_add`.
    const p = PREPARED.find((x) => x.subject.name === 'Buff S #1');
    if (!p) throw new Error('Buff S #1 not found among prepared subjects');
    expect(p.inference.issues).toEqual([]);
    expect(p.hero.sheet.critDmg - p.hero.birth!.critDmg - TREE_CRIT_DMG_PCT).toBeCloseTo(20 * 4, 9);
  });

  /**
   * Claim E — the crit-CHANCE witness, and the discriminating one for the 2026-08-23 shape.
   *
   * Perrin holds `olho_clinico` 13/20, wears nothing, and solves to zero crit-chance points, so
   * his sheet is exactly `roll + 13 x 2 + roll x crit_chance_add` with nothing else in it. Three
   * separate model claims fail this if any is wrong: percent-of-base overshoots the rank term,
   * pooling the flat addend inflates it by the tree factor, and reading the tree off the
   * post-ability sheet inflates the tree line more than fivefold.
   */
  it('claim E — Perrin (Olho Clínico 13, gear-free) pins the flat addend, its exclusion from the pool, and the tree base', () => {
    const p = PREPARED.find((x) => x.subject.name === 'Perrin');
    if (!p) throw new Error('Perrin not found among prepared subjects');
    expect(p.inference.issues).toEqual([]);
    expect(p.inference.pts.critChance, 'no crit-chance points — the whole delta is ability + tree').toBe(0);
    const roll = p.hero.birth!.critChance;
    expect(p.hero.sheet.critChance).toBeCloseTo(roll + 13 * 2 + roll * (TREE_CRIT_CHANCE_PCT / 100), 9);
  });

  it('claim B is exhaustive: all 13 heroes are issue-free', () => {
    expect(PREPARED.filter((p) => p.inference.issues.length === 0).length).toBe(13);
  });

  // Vitest's decimal-place fuzzy-equality matcher is banned in this file (grep-enforced): its
  // default precision is 2 decimal digits ⇒ ~5e-3 tolerance, which would silently accept an
  // error orders of magnitude looser than SHEET_ABS_TOL (1e-6) — exactly the kind of loosened
  // assertion AD-068 forbids substituting for a real one. One test per issue-free hero so a
  // failure names both the hero (the test title) and the key (expectSheetsClose's message).
  it.each(PREPARED.filter((p) => p.inference.issues.length === 0).map((p) => [subjectLabel(p.subject), p] as const))(
    'claim B — %s: forward sheet lands within SHEET_ABS_TOL of the observed stats on all 8 SHEET_KEYS',
    (_label, p) => {
      expectSheetsClose(p.forward, p.hero.sheet, SHEET_KEYS);
    },
  );

  /**
   * Claim C keeps an EXACT floor so the suite cannot drift into tolerance-only. Its shape moves
   * with the corpus and the model, and the change is a re-measurement rather than a weakening.
   *
   * `critDmg` has no gear term at all (items never roll it), so its chain is
   * `roll x star + ability + tree` and it reproduces bit-exactly on 11 of the 13 — the two
   * misses (WB #1, Manco #2) come from the save→planner unit conversion `(x − 1) x 100`, not
   * from the model: both carry only the tree's flat `crit_dmg_add`, whose exported delta is
   * exactly `0.081730769` before that conversion. `critChance` and `cdr` run through
   * `sharedForward`'s divide-then-multiply pool, whose accumulation order the game does not
   * share, so neither is bit-exact on a geared hero; `cdr` still lands exactly on the 3 heroes
   * with no cooldown gear roll, where the pool degenerates to a no-op.
   */
  it('claim C — critDmg bit-exact on 11/13, cdr on the gear-free ones, ≥21/104 overall', () => {
    const critDmgExact = PREPARED.filter((p) => Object.is(p.forward.critDmg, p.hero.sheet.critDmg));
    const critDmgMisses = PREPARED.filter((p) => !Object.is(p.forward.critDmg, p.hero.sheet.critDmg)).map((p) => subjectLabel(p.subject));
    expect(critDmgExact.length, `critDmg bit-exact on ${critDmgExact.length}/13; misses: ${critDmgMisses.join(', ')}`).toBe(11);

    const cdrExact = PREPARED.filter((p) => Object.is(p.forward.cdr, p.hero.sheet.cdr));
    const cdrMisses = PREPARED.filter((p) => !Object.is(p.forward.cdr, p.hero.sheet.cdr)).map((p) => subjectLabel(p.subject));
    expect(cdrExact.length, `cdr bit-exact on ${cdrExact.length}/13; misses: ${cdrMisses.join(', ')}`).toBe(3);

    const exactComparisons = PREPARED.reduce(
      (sum, p) => sum + SHEET_KEYS.filter((key) => Object.is(p.forward[key], p.hero.sheet[key])).length,
      0,
    );
    expect(exactComparisons, `${exactComparisons}/104 key comparisons bit-exact`).toBeGreaterThanOrEqual(21);
  });
});
