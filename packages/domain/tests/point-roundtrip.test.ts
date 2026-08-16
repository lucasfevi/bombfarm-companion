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

const EXPORT_FILE = 'save-20260816-8heroes.json';
const RESPEC_FILE = 'save-20260816-respec-cdr-crit.json';

/**
 * All 16 hero-instances across the two post-2026-08-15-patch corpus files — the suite's entire
 * subject set, no more, no fewer. The pre-patch captures (`save-20260813-5heroes.json`,
 * `payload-20260812-8heroes.json`) are NOT subjects here any more: they record a game whose crit
 * chance and cooldown were multiplicative shares of the roll, and no model can reproduce both
 * them and the current game. They stay committed for the structural suites that read them for
 * hero shapes rather than for sheet arithmetic.
 *
 * `RESPEC_FILE` is the same account minutes later with Torin L4 respecced from 3 attack + 1
 * energy into 2 cooldown + 2 crit chance — the before/after point-delta pair
 * `docs/fixture-corpus.md` §5 recorded as structurally unreproducible after the 2026-08-13 wipe.
 * Both sides round-trip, so the pair pins the flat per-point rates directly.
 */
const SUBJECTS: readonly { file: string; name: string; level: number }[] = [
  { file: EXPORT_FILE, name: 'Bellatrix', level: 53 },
  { file: EXPORT_FILE, name: 'Jon', level: 54 },
  { file: EXPORT_FILE, name: 'Gwen', level: 32 },
  { file: EXPORT_FILE, name: 'Minato', level: 42 },
  { file: EXPORT_FILE, name: 'Lorne', level: 27 },
  { file: EXPORT_FILE, name: 'Orin', level: 17 },
  { file: EXPORT_FILE, name: 'Korin', level: 13 },
  { file: EXPORT_FILE, name: 'Torin', level: 4 },
  { file: RESPEC_FILE, name: 'Bellatrix', level: 53 },
  { file: RESPEC_FILE, name: 'Jon', level: 54 },
  { file: RESPEC_FILE, name: 'Gwen', level: 32 },
  { file: RESPEC_FILE, name: 'Minato', level: 42 },
  { file: RESPEC_FILE, name: 'Lorne', level: 27 },
  { file: RESPEC_FILE, name: 'Orin', level: 18 },
  { file: RESPEC_FILE, name: 'Korin', level: 13 },
  { file: RESPEC_FILE, name: 'Torin', level: 4 },
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
  it('non-vacuity: iterates exactly 16 hero-instances across the two corpus files and 128 key comparisons', () => {
    expect(SUBJECTS.length, 'expected exactly 16 hero-instances across the two post-patch captures').toBe(16);
    expect(PREPARED.length).toBe(16);
    const totalComparisons = PREPARED.length * SHEET_KEYS.length;
    expect(totalComparisons, '16 hero-instances × 8 SHEET_KEYS').toBe(128);
  });

  it('claim A — inferSpentPoints reports zero issues for every hero, with no exception carved out', () => {
    expect(PREPARED.length, 'expected all 16 hero-instances to be checked').toBe(16);
    for (const p of PREPARED) {
      expect(p.inference.issues, `${subjectLabel(p.subject)} should be issue-free`).toEqual([]);
    }
  });

  it('claim D — Torin L4 pins the flat per-point rates across the respec pair', () => {
    const before = PREPARED.find((p) => p.subject.file === EXPORT_FILE && p.subject.name === 'Torin');
    const after = PREPARED.find((p) => p.subject.file === RESPEC_FILE && p.subject.name === 'Torin');
    if (!before || !after) throw new Error('Torin L4 not found on both sides of the respec pair');

    // He owns no items and no crit ability, so every sheet move between the two exports is the
    // stat-point term alone. 4 granted points, spent one way then the other.
    expect(before.inference.pts).toMatchObject({ attack: 3, energy: 1, critChance: 0, cdr: 0 });
    expect(after.inference.pts).toMatchObject({ attack: 0, energy: 0, critChance: 2, cdr: 2 });

    expect(after.hero.sheet.critChance - before.hero.sheet.critChance).toBeCloseTo(2 * 0.024394, 9);
    expect(after.hero.sheet.cdr - before.hero.sheet.cdr).toBeCloseTo(2 * 0.03513, 9);
  });

  it('claim B is exhaustive: all 16 hero-instances are issue-free', () => {
    expect(PREPARED.filter((p) => p.inference.issues.length === 0).length).toBe(16);
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
  it('claim C — the flat stats (critDmg, cdr) match bit-exactly on every hero, and ≥48/128 comparisons overall', () => {
    for (const key of ['critDmg', 'cdr'] as const) {
      const exact = PREPARED.filter((p) => Object.is(p.forward[key], p.hero.sheet[key]));
      const misses = PREPARED.filter((p) => !Object.is(p.forward[key], p.hero.sheet[key])).map((p) => subjectLabel(p.subject));
      expect(exact.length, `${key} bit-exact on ${exact.length}/16; misses: ${misses.join(', ') || 'none'}`).toBe(16);
    }
    const exactComparisons = PREPARED.reduce(
      (sum, p) => sum + SHEET_KEYS.filter((key) => Object.is(p.forward[key], p.hero.sheet[key])).length,
      0,
    );
    expect(exactComparisons, `${exactComparisons}/128 key comparisons bit-exact`).toBeGreaterThanOrEqual(48);
  });
});
