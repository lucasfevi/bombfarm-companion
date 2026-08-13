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

const EXPORT_FILE = 'save-20260813-5heroes.json';
const PAYLOAD_FILE = 'payload-20260812-8heroes.json';

/** All 13 heroes across both corpus files — the suite's entire subject set, no more, no fewer. */
const SUBJECTS: readonly { file: string; name: string; level: number }[] = [
  { file: EXPORT_FILE, name: 'Jon', level: 38 },
  { file: EXPORT_FILE, name: 'Bellatrix', level: 42 },
  { file: EXPORT_FILE, name: 'Perrin', level: 4 },
  { file: EXPORT_FILE, name: 'Perrin', level: 3 },
  { file: EXPORT_FILE, name: 'Lyra', level: 2 },
  { file: PAYLOAD_FILE, name: 'Nyx', level: 25 },
  { file: PAYLOAD_FILE, name: 'Bellatrix', level: 27 },
  { file: PAYLOAD_FILE, name: 'Cora', level: 22 },
  { file: PAYLOAD_FILE, name: 'Wren', level: 24 },
  { file: PAYLOAD_FILE, name: 'Lyra', level: 3 },
  { file: PAYLOAD_FILE, name: 'Mira', level: 3 },
  { file: PAYLOAD_FILE, name: 'Bryn', level: 3 },
  { file: PAYLOAD_FILE, name: 'Devin', level: 5 },
];

/**
 * The one genuinely point-ambiguous hero (design.md §0 finding 5, §2.7). Pinned, recorded in
 * `docs/fixture-corpus.md`, and NOT fixed here — the fixture is a game observation and
 * `packages/domain/src` is out of `mp5-fixture-rebaseline`'s scope. A round trip cannot
 * discriminate between two different point splits that both reproduce the observed `stats`;
 * that is an ambiguity in inference, not an error in application.
 */
const PINNED_AMBIGUOUS_HERO = { file: EXPORT_FILE, name: 'Bellatrix', level: 42 };

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
  it('non-vacuity: iterates exactly 13 heroes across the two corpus files and 104 key comparisons', () => {
    expect(SUBJECTS.length, 'expected exactly 13 heroes across save-20260813-5heroes.json + payload-20260812-8heroes.json').toBe(13);
    expect(PREPARED.length).toBe(13);
    const totalComparisons = PREPARED.length * SHEET_KEYS.length;
    expect(totalComparisons, '13 heroes × 8 SHEET_KEYS').toBe(104);
  });

  it('claim A — inferSpentPoints reports zero issues for every hero except the one pinned ambiguity', () => {
    const withIssues = PREPARED.filter(
      (p) => !(p.subject.file === PINNED_AMBIGUOUS_HERO.file && p.subject.name === PINNED_AMBIGUOUS_HERO.name && p.subject.level === PINNED_AMBIGUOUS_HERO.level),
    );
    expect(withIssues.length, 'expected 12 non-pinned heroes').toBe(12);
    for (const p of withIssues) {
      expect(p.inference.issues, `${subjectLabel(p.subject)} should be issue-free`).toEqual([]);
    }
  });

  it('claim D — Bellatrix L42 (export) is a real, game-observed inference ambiguity, pinned by kind and key', () => {
    const pinned = PREPARED.find(
      (p) => p.subject.file === PINNED_AMBIGUOUS_HERO.file && p.subject.name === PINNED_AMBIGUOUS_HERO.name && p.subject.level === PINNED_AMBIGUOUS_HERO.level,
    );
    if (!pinned) throw new Error('pinned ambiguous hero not found among prepared subjects');

    expect(pinned.inference.issues.length, 'exactly one issue').toBe(1);
    const issue = pinned.inference.issues[0];
    expect(issue.kind).toBe('nonIntegerPoints');
    if (issue.kind !== 'nonIntegerPoints') throw new Error('unreachable');
    expect(issue.key).toBe('critDmg');
    expect(issue.residual).toBeLessThan(0.5);
    expect(Math.round(issue.raw)).toBe(pinned.inference.pts.critDmg);

    // See docs/fixture-corpus.md §7 ("The known inference ambiguity") for the full write-up:
    // a round trip cannot discriminate between two different point splits that both reproduce
    // the observed stats. This is that ambiguity, pinned so it cannot silently drift or widen.
  });

  it('claim B is exhaustive: exactly 12 heroes are issue-free', () => {
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

  it('claim C — at least 2 heroes match bit-exactly (Object.is) across all 8 SHEET_KEYS', () => {
    const bitExact = PREPARED.filter((p) => SHEET_KEYS.every((key) => Object.is(p.forward[key], p.hero.sheet[key])));
    const names = bitExact.map((p) => subjectLabel(p.subject));
    expect(bitExact.length, `bit-exact heroes: ${names.join(', ') || 'none'}`).toBeGreaterThanOrEqual(2);
  });
});
