/**
 * The point round-trip invariant (an exactness bar of SHEET_ABS_TOL, a bit-exact floor, and the
 * ability terms pinned as flat addends) on the thickest post-boundary export in the corpus.
 *
 * **Why this is not circular (the ground-truth rule, satisfied):** the game observes
 * each hero's `stats` object directly and writes it into the export. That is a game
 * observation, not our output — `@bombfarm/domain` has to *land on it*. The forward chain
 * (`nakedFromBirth` → `applyPoints` → `applySkillTree`, wired here as `composeSheetFromBirth`)
 * consumes `inferSpentPoints`'s recovered point split only as an intermediate; the split is
 * never the assertion target. The assertion target — the expected value in every comparison
 * below — is `saveSheetUnits(hero.stats)`, the game's own reading. The ground-truth rule bans
 * pasting our own model's output in as an expected value; here the expected value is the game's.
 *
 * **The exactness bar**: literal bit-exactness (`Object.is`) is measurably
 * unachievable across the board — IEEE-754 association order differs between the game's own
 * accumulation and this forward chain's, producing residuals from ~1e-15 to ~5e-11 on most
 * heroes. The bar is therefore four claims, stronger together than either a bare `Object.is`
 * or a bare tolerance: (A) the point split is exact (zero inference issues) for every hero, the
 * issue-free set asserted by name so an exception cannot be carved out quietly; (D) every
 * ability sheet term is a flat addend outside the gear pool, pinned hero by hero; (B) the round
 * trip lands within `SHEET_ABS_TOL` for every hero; (C) a committed floor of exact (`Object.is`)
 * key comparisons — `cdr` on exactly the item-free heroes, `critDmg` on a measured two — so the
 * suite keeps a genuinely exact floor and cannot drift into tolerance-only.
 */
import { describe, expect, it } from 'vitest';
import { holdSuiteUntilInRegime } from './helpers/capture-regime';
import { composeSheetFromBirth } from '@bombfarm/domain/birth-sheet';
import { starsMult } from '@bombfarm/domain/gear';
import { POINT_GAIN } from '@bombfarm/domain/model';
import { inferSpentPoints } from '@bombfarm/domain/point-inference';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { expectSheetsClose, extractHero, loadFixtureJson, treeTotalsFromSave } from './helpers/sheet-math-fixtures';

const EXPORT_FILE = 'save-20260914-20heroes-phase101.json';

holdSuiteUntilInRegime(`sheet-math/${EXPORT_FILE}`, 'sheet');

/**
 * All 20 heroes of the main account's 2026-09-14 export — the suite's entire subject set, and the
 * first roster this invariant is asked of with starred heroes (★1 and ★2), real crit-chance,
 * crit-damage and cooldown points on high-level sheets (Bellatrix 20/69, Jon 3/47/11,
 * WB;KE 94 crit-damage), two heroes banking an unspent point (Jon and BP 04, 1 each), and
 * seven item-free heroes for the exact `cdr` floor. Two heroes share the name Torin and are told
 * apart by level.
 */
const SUBJECTS: readonly { file: string; name: string; level: number }[] = [
  { file: EXPORT_FILE, name: 'NotJ', level: 140 },
  { file: EXPORT_FILE, name: 'WB;KE', level: 121 },
  { file: EXPORT_FILE, name: 'WB;PA', level: 117 },
  { file: EXPORT_FILE, name: 'Bellatrix', level: 151 },
  { file: EXPORT_FILE, name: 'Minato', level: 132 },
  { file: EXPORT_FILE, name: 'Ivo', level: 121 },
  { file: EXPORT_FILE, name: 'Torin', level: 98 },
  { file: EXPORT_FILE, name: 'BP 02', level: 24 },
  { file: EXPORT_FILE, name: 'Edda', level: 124 },
  { file: EXPORT_FILE, name: 'BP 03', level: 22 },
  { file: EXPORT_FILE, name: 'BP 05', level: 21 },
  { file: EXPORT_FILE, name: 'BP 04', level: 23 },
  { file: EXPORT_FILE, name: 'Jon', level: 138 },
  { file: EXPORT_FILE, name: 'BP 01', level: 23 },
  { file: EXPORT_FILE, name: 'Elara', level: 110 },
  { file: EXPORT_FILE, name: 'Torin', level: 45 },
  { file: EXPORT_FILE, name: 'Doran', level: 113 },
  { file: EXPORT_FILE, name: 'Quill', level: 40 },
  { file: EXPORT_FILE, name: 'Bram', level: 1 },
  { file: EXPORT_FILE, name: 'Gale', level: 8 },
];

const ITEM_FREE = ['BP 02', 'BP 03', 'BP 05', 'BP 04', 'BP 01', 'Bram', 'Gale'];

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
  return { subject: s, hero, forward, inference, tree };
}

const PREPARED = SUBJECTS.map(prepare);

function prepared(name: string, level: number) {
  const p = PREPARED.find((x) => x.subject.name === name && x.subject.level === level);
  if (!p) throw new Error(`${name} L${level} not found among prepared subjects`);
  return p;
}

/** The capture's own `skills.totals`, in the units `treeTotalsFromSave` produces — read from the
 *  fixture rather than retyped, so a corpus swap cannot leave a stale literal behind. */
const FIXTURE_TREE = treeTotalsFromSave(
  (loadFixtureJson(EXPORT_FILE).skills as Record<string, unknown>).totals as Record<string, unknown>,
);
const TREE_CRIT_DMG_PCT = FIXTURE_TREE.critDmgPct;

describe('point round trip — birth + inferred points + gear + tree reproduces the observed stats', () => {
  it('non-vacuity: iterates exactly 20 heroes and 160 key comparisons', () => {
    expect(SUBJECTS.length, 'expected exactly 20 heroes on the 2026-09-14 main-account export').toBe(20);
    expect(PREPARED.length).toBe(20);
    const totalComparisons = PREPARED.length * SHEET_KEYS.length;
    expect(totalComparisons, '20 heroes × 8 SHEET_KEYS').toBe(160);
  });

  it('claim A — inferSpentPoints reports zero issues for every hero; the set with an issue is empty, by name', () => {
    expect(PREPARED.length, 'expected all 20 heroes to be checked').toBe(20);
    const withIssues = PREPARED.filter((p) => p.inference.issues.length > 0).map((p) => subjectLabel(p.subject));
    expect(withIssues).toEqual([]);
  });

  it('claim A — every hero solves to exactly level − stat_points_available, and two heroes bank one point', () => {
    const banking = PREPARED.filter((p) => p.hero.statPointsAvailable > 0).map((p) => [p.subject.name, p.hero.statPointsAvailable]);
    expect(banking).toEqual([
      ['BP 04', 1],
      ['Jon', 1],
    ]);
    for (const p of PREPARED) {
      const spent = SHEET_KEYS.reduce((sum, key) => sum + p.inference.pts[key], 0);
      expect(spent, `${subjectLabel(p.subject)}: total spent`).toBe(p.hero.level - p.hero.statPointsAvailable);
    }
  });

  /**
   * Claim D — crit damage is flat in every term it has. Items never roll it, so a hero's sheet is
   * `roll × star + points × 5 + ability + tree`, and the gap over the star-scaled roll is a sum
   * of flat addends. Three heroes pin the three terms at once: WB;KE and Bellatrix through real
   * points at ★1 and ★2, Elara through Golpe Brutal 20/20 at ★1 with no crit-damage point. The two
   * shapes that would each break this: modelling the point as a share of the roll (which left an
   * earlier Bellatrix's 2 points solving to 1.8867 before `POINT_GAIN.critDmgFlat` was measured),
   * and scaling any of the addends with stars.
   */
  it('claim D — crit DAMAGE is flat: points × 5, Golpe Brutal +80 and the tree sit on the star-scaled roll', () => {
    const gapOverRoll = (name: string, level: number) => {
      const p = prepared(name, level);
      return p.hero.sheet.critDmg - p.hero.birth!.critDmg * starsMult(p.hero.stars) - TREE_CRIT_DMG_PCT;
    };
    expect(prepared('WB;KE', 121).inference.pts.critDmg).toBe(94);
    expect(gapOverRoll('WB;KE', 121)).toBeCloseTo(94 * POINT_GAIN.critDmgFlat, 9);
    expect(prepared('Bellatrix', 151).inference.pts.critDmg).toBe(69);
    expect(gapOverRoll('Bellatrix', 151)).toBeCloseTo(69 * POINT_GAIN.critDmgFlat, 9);
    expect(prepared('Elara', 110).inference.pts.critDmg).toBe(0);
    expect(prepared('Elara', 110).hero.sheetOther.critDmgFlat).toBe(80);
    expect(gapOverRoll('Elara', 110)).toBeCloseTo(80, 9);
  });

  /**
   * Claim E — every ability sheet term is a flat addend OUTSIDE the gear pool. Composing the same
   * recovered points with the ability zeroed lands exactly the addend below the exported sheet:
   * +40 crit chance for Olho Clínico 20/20 (WB;KE and Torin, both ★1 and geared 8/8, both solving
   * to zero crit-chance points), +20 penetration for Ponta de Diamante 20/20 (Minato, ★2). A term
   * pooled with the gear rolls would come back scaled by the tree factor instead; a
   * percent-of-base term would vary with the roll and the star.
   */
  it('claim E — Olho Clínico +40 and Ponta de Diamante +20 are flat addends outside the pool, on starred geared heroes', () => {
    const withoutAbility = (name: string, level: number) => {
      const p = prepared(name, level);
      return composeSheetFromBirth({
        birth: p.hero.birth!,
        level: p.hero.level,
        stars: p.hero.stars,
        sheetOther: { ...p.hero.sheetOther, critChanceFlat: 0, penetration: 0 },
        loadout: p.hero.loadout,
        pts: p.inference.pts,
        tree: p.tree,
      });
    };
    for (const [name, level] of [
      ['WB;KE', 121],
      ['Torin', 98],
    ] as const) {
      const p = prepared(name, level);
      expect(p.hero.sheetOther.critChanceFlat, `${name}: Olho Clínico 20/20`).toBe(40);
      expect(p.inference.pts.critChance, `${name}: no crit-chance points — the whole delta is ability + tree + gear`).toBe(0);
      expect(p.hero.sheet.critChance - withoutAbility(name, level).critChance).toBeCloseTo(40, 9);
    }
    const minato = prepared('Minato', 132);
    expect(minato.hero.sheetOther.penetration, 'Ponta de Diamante 20/20').toBe(20);
    expect(minato.inference.pts.penetration).toBe(0);
    expect(minato.hero.sheet.penetration - withoutAbility('Minato', 132).penetration).toBeCloseTo(20, 9);
  });

  it('claim B is exhaustive: all 20 heroes are issue-free', () => {
    expect(PREPARED.filter((p) => p.inference.issues.length === 0).length).toBe(20);
  });

  // Vitest's decimal-place fuzzy-equality matcher is not used for the round trip itself: its
  // default precision is 2 decimal digits ⇒ ~5e-3 tolerance, which would silently accept an error
  // orders of magnitude looser than SHEET_ABS_TOL (1e-6) — exactly the kind of loosened assertion
  // the ground-truth rule forbids substituting for a real one. One test per hero so a failure
  // names both the hero (the test title) and the key (expectSheetsClose's message).
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
   * `critChance` and `cdr` run through `sharedForward`'s divide-then-multiply pool, whose
   * accumulation order the game does not share, so neither is bit-exact on a geared hero; `cdr`
   * lands exactly on every item-free hero, where the pool degenerates to a no-op — a rule, so
   * the set is asserted by name. `critDmg` has no gear term, but this tree's `crit_dmg_add` is
   * exported as `0.6799999986`, and its `(x − 1) × 100` conversion rounds the same way as the
   * game's own accumulation on only two of the twenty sheets.
   */
  it('claim C — cdr bit-exact on exactly the 7 item-free heroes, critDmg on 2/20, ≥21/160 overall', () => {
    const cdrExact = PREPARED.filter((p) => Object.is(p.forward.cdr, p.hero.sheet.cdr)).map((p) => p.subject.name);
    expect(cdrExact).toEqual(ITEM_FREE);
    for (const name of ITEM_FREE) {
      expect(Object.values(prepared(name, SUBJECTS.find((s) => s.name === name)!.level).hero.loadout).filter(Boolean), name).toEqual([]);
    }

    const critDmgExact = PREPARED.filter((p) => Object.is(p.forward.critDmg, p.hero.sheet.critDmg)).map((p) => p.subject.name);
    expect(critDmgExact).toEqual(['BP 05', 'Quill']);

    const exactComparisons = PREPARED.reduce(
      (sum, p) => sum + SHEET_KEYS.filter((key) => Object.is(p.forward[key], p.hero.sheet[key])).length,
      0,
    );
    expect(exactComparisons, `${exactComparisons}/160 key comparisons bit-exact`).toBeGreaterThanOrEqual(21);
  });
});
