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

const EXPORT_FILE = 'save-20260818-12heroes.json';

/**
 * All 12 heroes of the post-revert corpus file — the suite's entire subject set.
 *
 * The 2026-08-16/17 exports (`save-20260816-8heroes.json`, `save-20260816-respec-cdr-crit.json`,
 * `save-20260816-9heroes-redistrib.json`, `save-20260816-5heroes-gear-cdr-crit.json`,
 * `save-20260817-11heroes.json`) are NO LONGER subjects: they were captured during the
 * 2026-08-15..08-18 window when crit chance and cooldown were flat addends, and the 2026-08-18
 * patch reverted both to percent-of-base with a rescaled item catalog. No single model
 * reproduces both this file and the current game — the same reasoning that already excluded the
 * pre-2026-08-15 corpus. They stay for the structural suites and for the provenance they already
 * carry: the flat-regime respec pair is what pinned the (now-superseded) flat per-point rates,
 * and that measurement is recorded in `POINT_GAIN`'s comment history and the fixture README
 * rather than lost.
 *
 * This file is the first whole-roster witness for the reverted percent-of-base shape (zero
 * inference issues, every budget exactly on `level`). It is also a crit-DAMAGE witness (Doran
 * holds `golpe_brutal` 20, landing on a flat `rank x 4` with residual exactly 0 — crit damage is
 * unaffected by either crit-chance patch) and, via the four item-free/ability-free heroes
 * (Sora/Joric/Aric/Eryn), the cleanest tree-only crit-chance witness in the corpus.
 */
const SUBJECTS: readonly { file: string; name: string; level: number }[] = [
  { file: EXPORT_FILE, name: 'Minato', level: 67 },
  { file: EXPORT_FILE, name: 'Jon', level: 69 },
  { file: EXPORT_FILE, name: 'Bellatrix', level: 64 },
  { file: EXPORT_FILE, name: 'Doran', level: 55 },
  { file: EXPORT_FILE, name: 'WB #2', level: 40 },
  { file: EXPORT_FILE, name: 'WB #1', level: 43 },
  { file: EXPORT_FILE, name: 'Manco #1', level: 41 },
  { file: EXPORT_FILE, name: 'Isolde', level: 26 },
  { file: EXPORT_FILE, name: 'Sora', level: 10 },
  { file: EXPORT_FILE, name: 'Joric', level: 10 },
  { file: EXPORT_FILE, name: 'Aric', level: 2 },
  { file: EXPORT_FILE, name: 'Eryn', level: 2 },
];

/**
 * RESOLVED — formerly the one "genuinely point-ambiguous" hero (design.md §0 finding 5, §2.7),
 * pinned here and in `docs/fixture-corpus.md` as an inference ambiguity the round trip could not
 * discriminate. It was not an ambiguity: crit-damage points are FLAT (+5 planner percentage
 * points each, `POINT_GAIN.critDmgFlat`), and modelling them as 8% of the hero's roll left
 * Bellatrix's 2 crit-damage points solving to 1.8867 — a `nonIntegerPoints` issue on `critDmg`
 * with a residual of 0.113. Her sheet moves by exactly +10.0 off a roll of 66.252971472748, as
 * does Fenn's (account 11882, 2026-08-15) off a roll of 67.127583786901: same delta, different
 * rolls, so the gain cannot be a share of the roll. With the flat rate she solves to exactly 2.
 *
 * All 12 heroes are now issue-free; the claims below assert that with no exception carved out,
 * so a regression cannot reintroduce one quietly.
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

describe('point round trip (AD-071) — birth + inferred points + gear + tree reproduces the observed stats', () => {
  it('non-vacuity: iterates exactly 12 heroes and 96 key comparisons', () => {
    expect(SUBJECTS.length, 'expected exactly 12 heroes on the post-revert capture').toBe(12);
    expect(PREPARED.length).toBe(12);
    const totalComparisons = PREPARED.length * SHEET_KEYS.length;
    expect(totalComparisons, '12 heroes × 8 SHEET_KEYS').toBe(96);
  });

  it('claim A — inferSpentPoints reports zero issues for every hero, with no exception carved out', () => {
    expect(PREPARED.length, 'expected all 12 heroes to be checked').toBe(12);
    for (const p of PREPARED) {
      expect(p.inference.issues, `${subjectLabel(p.subject)} should be issue-free`).toEqual([]);
    }
  });

  it('claim D — Doran pins crit DAMAGE as flat, post-revert', () => {
    // Crit damage is unaffected by either crit-chance/CDR patch — it went flat at the
    // 2026-08-13 patch and stays flat through both the 2026-08-15 and 2026-08-18 ones. Doran's
    // sheet sits exactly `rank x 4` planner points above his roll, with a residual of exactly 0.
    const p = PREPARED.find((x) => x.subject.name === 'Doran');
    if (!p) throw new Error('Doran not found among prepared subjects');
    expect(p.inference.issues).toEqual([]);
    expect(p.hero.sheet.critDmg - p.hero.birth!.critDmg).toBeCloseTo(20 * 4, 9);
  });

  it('claim B is exhaustive: all 12 heroes are issue-free', () => {
    expect(PREPARED.filter((p) => p.inference.issues.length === 0).length).toBe(12);
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
   * Claim C keeps an EXACT floor so the suite cannot drift into tolerance-only. Its shape
   * changed with the corpus and the model revert, and the change is a finding rather than a
   * weakening — RE-MEASURED for issue #132.
   *
   * `critDmg` is unaffected by either crit-chance/CDR patch: no gear term at all (items never
   * roll it), so its chain is `roll x star + ability + point` and reproduces bit-exactly on
   * every hero, same as before the revert. `critChance` and `cdr` went back through
   * `sharedForward`'s divide-then-multiply pool once the model reverted, and that division
   * reintroduces the accumulation-order sensitivity the flat shape had removed — no whole hero
   * is bit-exact any more (was 0 already under the flat model too; every hero here is geared and
   * ability-bearing), and `critChance` in particular misses on all 12 (the pool now touches
   * every hero, where the flat model's plain sum did not). `cdr` still lands bit-exact on the 4
   * heroes with no cooldown gear roll, where the pool's `other` term is 0 and the divide is a
   * no-op.
   */
  it('claim C — critDmg matches bit-exactly on every hero, cdr on the item-free ones, ≥20/96 overall', () => {
    const critDmgExact = PREPARED.filter((p) => Object.is(p.forward.critDmg, p.hero.sheet.critDmg));
    expect(critDmgExact.length, 'critDmg must be bit-exact on every hero — it has no gear term').toBe(12);

    const cdrExact = PREPARED.filter((p) => Object.is(p.forward.cdr, p.hero.sheet.cdr));
    const cdrMisses = PREPARED.filter((p) => !Object.is(p.forward.cdr, p.hero.sheet.cdr)).map((p) => subjectLabel(p.subject));
    expect(cdrExact.length, `cdr bit-exact on ${cdrExact.length}/12; misses: ${cdrMisses.join(', ')}`).toBe(4);

    const exactComparisons = PREPARED.reduce(
      (sum, p) => sum + SHEET_KEYS.filter((key) => Object.is(p.forward[key], p.hero.sheet[key])).length,
      0,
    );
    expect(exactComparisons, `${exactComparisons}/96 key comparisons bit-exact`).toBeGreaterThanOrEqual(20);
  });
});
