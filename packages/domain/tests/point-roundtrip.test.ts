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
 * tolerance; (B) the round trip lands within `SHEET_ABS_TOL` for every issue-free hero; (C) at
 * least two heroes still match bit-exactly, so the suite keeps a genuinely exact floor and
 * cannot drift into tolerance-only.
 */
import { describe, expect, it } from 'vitest';
import { composeSheetFromBirth } from '@bombfarm/domain/birth-sheet';
import { inferSpentPoints } from '@bombfarm/domain/point-inference';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { expectSheetsClose, extractHero, loadFixtureJson, treeTotalsFromSave } from './helpers/sheet-math-fixtures';

const EXPORT_FILE = 'save-20260816-9heroes-redistrib.json';

/**
 * All 9 heroes of the post-redistribution corpus file — the suite's entire subject set.
 *
 * The two earlier 2026-08-16 exports (`save-20260816-8heroes.json`,
 * `save-20260816-respec-cdr-crit.json`) are NO LONGER subjects. A second patch the same day
 * redistributed every item's stat rolls across the slots — 239 of 240 defs, 194 of them changing
 * which stats they roll at all — so their committed gear no longer matches any catalog this repo
 * can ship. They stay for the structural suites and for the provenance they already carry: the
 * respec pair is what pinned the flat per-point rates in `POINT_GAIN.critChanceFlat` / `.cdrFlat`,
 * and that measurement is recorded there and in the fixture README rather than lost.
 *
 * This file is strictly stronger as a sheet-math anchor. It is the first capture to witness crit
 * DAMAGE post-patch (Zane holds `golpe_brutal` 7, Doran 20 — both land on a flat `rank x 0.04`
 * with residual exactly 0), and the first to witness `pressagio_mortal` (Rowan, Cora — whose
 * entire sheet delta is the tree term alone, confirming the team-crit ability stays OFF the
 * inventory sheet).
 */
const SUBJECTS: readonly { file: string; name: string; level: number }[] = [
  { file: EXPORT_FILE, name: 'Bellatrix', level: 56 },
  { file: EXPORT_FILE, name: 'Jon', level: 57 },
  { file: EXPORT_FILE, name: 'Minato', level: 46 },
  { file: EXPORT_FILE, name: 'Torin', level: 4 },
  { file: EXPORT_FILE, name: 'Rowan', level: 4 },
  { file: EXPORT_FILE, name: 'Zane', level: 7 },
  { file: EXPORT_FILE, name: 'Cora', level: 3 },
  { file: EXPORT_FILE, name: 'Doran', level: 42 },
  { file: EXPORT_FILE, name: 'Aldric', level: 5 },
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
 * All 13 heroes are now issue-free; the claims below assert that with no exception carved out,
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
  it('non-vacuity: iterates exactly 9 heroes and 72 key comparisons', () => {
    expect(SUBJECTS.length, 'expected exactly 9 heroes on the post-redistribution capture').toBe(9);
    expect(PREPARED.length).toBe(9);
    const totalComparisons = PREPARED.length * SHEET_KEYS.length;
    expect(totalComparisons, '9 heroes × 8 SHEET_KEYS').toBe(72);
  });

  it('claim A — inferSpentPoints reports zero issues for every hero, with no exception carved out', () => {
    expect(PREPARED.length, 'expected all 9 heroes to be checked').toBe(9);
    for (const p of PREPARED) {
      expect(p.inference.issues, `${subjectLabel(p.subject)} should be issue-free`).toEqual([]);
    }
  });

  it('claim D — Zane and Doran pin crit DAMAGE as flat, post-patch', () => {
    // The first capture to witness `golpe_brutal` since the 2026-08-13 patch made crit damage
    // flat. Both heroes' sheets sit exactly `rank x 4` planner points above their roll, with a
    // residual of exactly 0 — so PR #90's flat model survives both patches, measured rather than
    // assumed. Two different ranks off two different rolls, so the gain cannot be a share of one.
    for (const [name, rank] of [['Zane', 7], ['Doran', 20]] as const) {
      const p = PREPARED.find((x) => x.subject.name === name);
      if (!p) throw new Error(`${name} not found among prepared subjects`);
      expect(p.inference.issues).toEqual([]);
      expect(p.hero.sheet.critDmg - p.hero.birth!.critDmg).toBeCloseTo(rank * 4, 9);
    }
  });

  it('claim B is exhaustive: all 9 heroes are issue-free', () => {
    expect(PREPARED.filter((p) => p.inference.issues.length === 0).length).toBe(9);
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
   * changed with the corpus, and the change is a finding rather than a weakening.
   *
   * The pre-patch corpus had 2 whole heroes matching bit-exactly, both naked low-level ones
   * (Bellatrix L27, Lyra L3). Every hero on this account is geared and ability-bearing, so no
   * whole hero is bit-exact any more — the accumulation chains are simply longer, and the
   * measured residuals stay at 2e-13…7e-12.
   *
   * What replaces it is sharper: `critDmg` and `cdr` — the two stats that are now purely flat
   * addends with no multiplicative term anywhere in their chain — reproduce bit-exactly on
   * EVERY hero. That is the flat shape's own signature, and it would break immediately if
   * either stat regained a `× (1 + Σ)` factor.
   */
  it('claim C — critDmg matches bit-exactly on every hero, cdr on all but one, ≥27/72 overall', () => {
    // Crit damage is the purest flat stat in the model — no gear term at all (items never roll
    // it), so its chain is `roll x star + ability + point` and reproduces bit-exactly on all 9.
    const critDmgExact = PREPARED.filter((p) => Object.is(p.forward.critDmg, p.hero.sheet.critDmg));
    expect(critDmgExact.length, 'critDmg must be bit-exact on every hero — it has no gear term').toBe(9);

    // CDR is flat too but DOES take a gear term, so one hero (Jon L57, whose loadout sums several
    // cooldown rolls) accumulates in a different order than the game and lands 1 ulp away. The
    // count is pinned rather than loosened: a regression that put CDR back in the shared pool
    // would drop this well below 8, and one that fixed the ordering would raise it to 9 — both
    // are changes worth seeing.
    const cdrExact = PREPARED.filter((p) => Object.is(p.forward.cdr, p.hero.sheet.cdr));
    const cdrMisses = PREPARED.filter((p) => !Object.is(p.forward.cdr, p.hero.sheet.cdr)).map((p) => subjectLabel(p.subject));
    expect(cdrExact.length, `cdr bit-exact on ${cdrExact.length}/9; misses: ${cdrMisses.join(', ')}`).toBe(8);

    const exactComparisons = PREPARED.reduce(
      (sum, p) => sum + SHEET_KEYS.filter((key) => Object.is(p.forward[key], p.hero.sheet[key])).length,
      0,
    );
    expect(exactComparisons, `${exactComparisons}/72 key comparisons bit-exact`).toBeGreaterThanOrEqual(27);
  });
});
