/**
 * The invariant nobody was asserting: **a hero can never have spent more stat points than its
 * level.** The game grants exactly one point per level, so `Σ pts ≤ level` is a hard ceiling —
 * `inferSpentPoints` returning more than `level` is not a close call, it is proof that some
 * contribution to the sheet is being mis-attributed to spent points.
 *
 * This is the guard that would have caught the `golpe_brutal` unit bug on the day it shipped.
 * Golpe Brutal was modelled as `critDmgPctOfBase` (4% of the hero's crit-damage roll per level)
 * when the game applies it FLAT (+4 crit-damage percentage points per level). On Ivo — L38,
 * Golpe Brutal 20/20, zero unspent points — the unexplained residual landed in `critDmg` and
 * inference recovered **50** points for a level-38 hero. Nothing in the suite objected, because
 * nothing looked at the ceiling.
 *
 * Three layers, deliberately:
 *
 * 0. **The regime-independent form** (its own describe block, further down) — every hero the
 *    IMPORTER produces, over the whole fixture tree with no exclusion list, asserting the weaker
 *    but universally true claim that an inversion reporting NO issue never exceeds the ceiling.
 *    Layer 1 below can only run where today's math reproduces the capture, which had narrowed it
 *    to a single file; this one sweeps them all.
 * 1. **Corpus sweep** — every committed capture under `tests/fixtures/**`, discovered by walking
 *    the tree rather than by a hand-maintained list, so a capture dropped in later is covered
 *    without editing this file.
 * 2. **The Golpe Brutal case** — no committed capture carries the ability (checked: zero hits for
 *    `golpe_brutal` across `packages/domain/tests/fixtures/**` and `apps/web/src/tests/fixtures/**`),
 *    so layer 1 cannot exercise the very bug this file exists for. Layer 2 closes that with the
 *    game-observed numbers from the hero itself, in save units — the same practice
 *    `save-units.test.ts` already uses for Bellatrix's `crit_dmg` literal. The values are the
 *    game's own reading, not this model's output (`AD-068`).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { inferSpentPoints } from '@bombfarm/domain/point-inference';
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { extractHero, treeTotalsFromSave, type SaveHeroSheet } from './helpers/sheet-math-fixtures';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(here, 'fixtures');

/**
 * `rejection/` exists to be REJECTED by `parseSaveFile` — a pre-update save and a truncated one.
 * Neither is a capture whose heroes this invariant is a claim about; skipped by name, not by a
 * silent parse-failure fallthrough.
 */
const SKIPPED_DIRS = ['rejection'];

/**
 * Captures whose crit-chance/CDR shape does not match the CURRENT game, spanning two regime
 * boundaries — renamed and extended from the original `PRE_2026_08_15_PATCH_CAPTURES` list, which
 * covered only the first one:
 *
 * - **Pre-2026-08-15**: crit chance and cooldown were multiplicative shares of the hero's roll,
 *   same shape as today, but the item catalog and stat redistribution that followed make their
 *   committed gear match no catalog this repo can ship.
 * - **2026-08-15 .. 2026-08-18 (flat regime)**: crit chance and cooldown were flat addends for
 *   exactly three days (commit 0418a82 / PR #102), reverted by the 2026-08-18 patch which also
 *   rescaled the item catalog's `crit`/`cooldown` bases. A capture from this window solves this
 *   invariant only under the flat model, not the current percent-of-base one.
 *
 * They all stay committed — ~50 structural suites read them for hero shapes, inventory and
 * team-plan inputs, none of which either patch touched — but none of them are subjects of THIS
 * invariant, because no single model can reproduce a mix of pre-flat, flat and post-flat captures
 * at once. Sweeping them here would assert that today's sheet math explains a different regime's
 * game.
 *
 * Named explicitly, never pattern-matched: a capture added later is swept by default, which is
 * the property that makes layer 1 worth having. Their own sheet arithmetic is no longer covered
 * anywhere — that is the accepted cost of each patch, recorded in `docs/fixture-corpus.md`.
 */
const NON_CURRENT_REGIME_CAPTURES = [
  'sheet-math/save-20260813-5heroes.json',
  'sheet-math/payload-20260812-8heroes.json',
  'api/assembled-payload-after.json',
  'api/assembled-payload-before.json',
  'api/assembled-payload-partial.json',
  'api/assembled-payload-drift.json',
  'farm-rate/save-20260815-486-7heroes.json',
  'fidelity-gate/export-capture.json',
  'fidelity-gate/live-capture.json',
  // The five 2026-08-16/17 captures that used to sit here — two excluded for the stat
  // REDISTRIBUTION that reshuffled 239 of 240 slot definitions, three for the flat crit/cooldown
  // regime — have been retired from the corpus outright, so there is nothing left to exclude.
  // Pre-2026-08-23: Olho Clínico was a percentage of the hero's crit-chance roll and became
  // flat crit POINTS. All three carry three rank-20/18 Olho heroes apiece, so their crit-chance
  // column solves only under the shape they were taken in.
  'sheet-math/save-20260818-12heroes.json',
  'sheet-math/save-20260819-respec-crit-cdr.json',
  'sheet-math/save-20260822-15heroes-tree-crit-dmg.json',
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function listJson(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.includes(entry.name)) listJson(full, acc);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      acc.push(full);
    }
  }
  return acc;
}

type Subject = { file: string; hero: SaveHeroSheet; recovered: number };

/** Every hero, in every committed capture, that carries the full birth + stats shape. */
function collectSubjects(): Subject[] {
  const subjects: Subject[] = [];
  for (const path of listJson(FIXTURES_DIR)) {
    const label = relative(FIXTURES_DIR, path).replace(/\\/g, '/');
    if (NON_CURRENT_REGIME_CAPTURES.includes(label)) continue;
    const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!isObject(raw) || !Array.isArray(raw.heroes) || !isObject(raw.skills)) continue;
    const totalsRaw = isObject(raw.skills.totals) ? raw.skills.totals : {};
    const tree = treeTotalsFromSave(totalsRaw);
    for (const rawHero of raw.heroes) {
      if (!isObject(rawHero) || !isObject(rawHero.birth_stats) || !isObject(rawHero.stats)) continue;
      const hero = extractHero(raw as Record<string, unknown>, String(rawHero.name), Number(rawHero.level));
      const { pts } = inferSpentPoints({
        birth: hero.birth!,
        level: hero.level,
        stars: hero.stars,
        sheetOther: hero.sheetOther,
        loadout: hero.loadout,
        tree,
        sheet: hero.sheet,
        statPointsAvailable: hero.statPointsAvailable,
      });
      subjects.push({
        file: label,
        hero,
        recovered: SHEET_KEYS.reduce((sum, key) => sum + pts[key], 0),
      });
    }
  }
  return subjects;
}

const SUBJECTS = collectSubjects();

describe('spent stat points never exceed the hero level (corpus sweep)', () => {
  /**
   * Non-vacuity, re-measured after the 2026-08-18 patch narrowed the swept set a second time.
   * Excluding every non-current-regime capture ({@link NON_CURRENT_REGIME_CAPTURES}) leaves the
   * THREE post-revert exports — `save-20260818-12heroes.json` (12 heroes),
   * `save-20260819-respec-crit-cdr.json` (12) and `save-20260822-15heroes-tree-crit-dmg.json`
   * (15) — all under `sheet-math/`.
   *
   * The directory-spread half of this guard is therefore GONE, not merely relaxed, and the count
   * is what carries it instead. It comes back on its own the moment a post-patch capture lands in
   * another directory, which is why the exclusion list is explicit and the walk is not.
   *
   * The per-file breakdown is asserted, not just the total: a total alone would stay green if one
   * capture stopped being swept while another grew, which is the failure this guard exists for.
   */
  it('non-vacuity: the walk finds every post-revert capture, with heroes in them', () => {
    const byFile = new Map<string, number>();
    for (const s of SUBJECTS) byFile.set(s.file, (byFile.get(s.file) ?? 0) + 1);
    expect(Object.fromEntries([...byFile].sort()), `walked ${FIXTURES_DIR}`).toEqual({
      'sheet-math/save-20260823-13heroes-crit-points.json': 13,
    });
    expect(SUBJECTS.length).toBe(13);
    const dirs = new Set(SUBJECTS.map((s) => s.file.split('/')[0]));
    expect(dirs, `capture directories reached: ${[...dirs].join(', ')}`).toEqual(new Set(['sheet-math']));
  });

  it('every hero in every committed capture recovers at most `level` points', () => {
    const offenders = SUBJECTS.filter((s) => s.recovered > s.hero.level).map(
      (s) => `${s.file} → ${s.hero.name} L${s.hero.level}: recovered ${s.recovered} points`,
    );
    expect(
      offenders,
      `heroes whose inferred spend exceeds their level — a hero is granted exactly one point ` +
        `per level, so this is a mis-attributed sheet contribution, not a large build:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});

/**
 * The same ceiling, stated so that it does NOT need an exclusion list — and read off the
 * production import path rather than off this file's own call to `inferSpentPoints`.
 *
 * WHY A SECOND FORM EXISTS. The sweep above can only run where today's sheet math reproduces the
 * capture, so every capture from an older crit/cooldown regime has to be named and skipped. That
 * shrank it to a single file, and a guard whose subject set is one capture is one deletion away
 * from being vacuous. It also leaves the honest question unanswered: an old-regime capture is
 * skipped, so nobody ever finds out whether importing it produces a legal hero.
 *
 * THE REGIME-INDEPENDENT STATEMENT. When `inferSpentPoints` cannot invert a sheet exactly it says
 * so, on that hero, as a `PointInferenceIssue`. So the claim that holds under every regime is not
 * "no hero over-spends" but: **an inversion that reports NO issue never claims more points than
 * the hero's level.**
 *
 * An issue-flagged hero is the model admitting it could not solve the capture, and the excess is a
 * diagnosis rather than a defect — measured across the corpus it lands in `critChance`, `cdr` and
 * `penetration`, exactly the three columns the 2026-08-15 / 08-18 / 08-23 patches reshaped. An
 * issue-FREE hero over the ceiling is the opposite: the model claiming it solved the sheet, with
 * an answer the game cannot grant. That is a real defect under any regime, which is why this form
 * needs no exclusion list and sweeps the whole corpus, old captures included.
 *
 * It reads `parseAccountPayload`, so the subject is the vector the app actually stores on a
 * `HeroRecord`. The sweep above deliberately keeps its direct `inferSpentPoints` call: the two
 * together say the inversion is exact AND that nothing between the inversion and the record
 * inflates it.
 */
type ImportedHero = {
  file: string;
  name: string;
  level: number;
  spent: number;
  issueFree: boolean;
};

function collectImported(): ImportedHero[] {
  const imported: ImportedHero[] = [];
  for (const path of listJson(FIXTURES_DIR)) {
    const label = relative(FIXTURES_DIR, path).replace(/\\/g, '/');
    const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!isObject(raw) || !Array.isArray(raw.heroes)) continue;
    const parsed = parseAccountPayload(raw as never, []);
    if (parsed.rejected) continue;
    for (const candidate of parsed.candidates) {
      imported.push({
        file: label,
        name: candidate.record.name,
        level: candidate.record.level,
        spent: SHEET_KEYS.reduce((sum, key) => sum + candidate.record.pts[key], 0),
        issueFree: candidate.pointIssues.length === 0,
      });
    }
  }
  return imported;
}

const IMPORTED = collectImported();

describe('an issue-free inversion never over-spends (whole corpus, every regime)', () => {
  /**
   * Non-vacuity by COUNT and by SPREAD rather than by naming files: this sweep exists to survive
   * the corpus changing under it, so pinning an exact file list would recreate the maintenance
   * the exclusion list above imposes. What it pins instead is that the walk reaches several
   * capture directories and finds a substantial number of issue-free heroes to make a claim
   * about — both of which collapse if the walk breaks or if `pointIssues` starts firing on
   * everything.
   *
   * Floors rather than exact counts, for the same reason: 61 issue-free heroes across 4
   * directories at the time of writing, and the floors sit well under that, so a capture landing
   * or leaving does not edit this file while a walk that silently stops walking does.
   */
  it('non-vacuity: the walk imports heroes from several directories, and most invert cleanly', () => {
    expect(IMPORTED.length, 'heroes imported from the fixture tree').toBeGreaterThanOrEqual(100);
    const issueFree = IMPORTED.filter((hero) => hero.issueFree);
    expect(issueFree.length, 'issue-free heroes — the subjects of the claim below').toBeGreaterThanOrEqual(40);
    const dirs = new Set(issueFree.map((hero) => hero.file.split('/')[0]));
    expect(dirs.size, `directories reached: ${[...dirs].sort().join(', ')}`).toBeGreaterThanOrEqual(3);
  });

  it('no hero the model claims to have solved spends more than its level', () => {
    const offenders = IMPORTED.filter((hero) => hero.issueFree && hero.spent > hero.level).map(
      (hero) => `${hero.file} → ${hero.name} L${hero.level}: ${hero.spent} points, no inference issue`,
    );
    expect(
      offenders,
      'an inversion that reported no issue produced a build the game cannot grant — the model is ' +
        `claiming an exact answer that exceeds the one-point-per-level budget:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  /**
   * The other half of the same statement, and the reason the filter above is a filter rather than
   * a blanket skip: the heroes this guard cannot vouch for are counted, not silently dropped. If a
   * later change made today's math reproduce the old regimes, this goes red and says so; so does a
   * change that starts failing to invert captures that used to solve cleanly.
   */
  it('every over-spent hero in the corpus is one the model already flagged', () => {
    const overspent = IMPORTED.filter((hero) => hero.spent > hero.level);
    expect(overspent.length, 'over-spent heroes in the corpus').toBeGreaterThan(0);
    const unflagged = overspent.filter((hero) => hero.issueFree).map((hero) => `${hero.file} → ${hero.name}`);
    expect(unflagged, 'over-spent heroes carrying NO inference issue').toEqual([]);
  });
});

/**
 * Ivo, id `21076`, account 11882, capture 2026-08-15. Level 38, ★0, `stat_points_available: 0`
 * (so exactly 38 points are spent), Golpe Brutal 20/20 and Fortuna 18/20 — Fortuna is a loot
 * aura with no sheet term, so Golpe Brutal is the only ability touching these numbers.
 *
 * `crit_dmg` moves from `1.45238210566148` to `2.25238210566148`: **exactly +0.8**, i.e.
 * `20 × 0.04` added flat. Percent-of-base would have produced `20 × 0.04 × 1.45238…` and left a
 * residual that inference charges to `critDmg` points — 12 of them, on top of a roster that
 * already accounts for all 38.
 */
const IVO_LEVEL = 38;
const IVO_ABILITIES = { golpe_brutal: 20, fortuna: 18 };
/** The two numbers that are game observations. Everything else below is constructed. */
const IVO_BIRTH_CRIT_DMG = 1.45238210566148;
const IVO_STATS_CRIT_DMG = 2.25238210566148;

/**
 * Ivo's real gear (8 items) is not reproducible without committing the capture, so the OTHER
 * seven stats are constructed here rather than transcribed: no gear, and all 38 points parked in
 * `energia` (`+8 native` each, ★0 ⇒ `100 + 38 × 8 = 404`), with `dmg` carrying only the level
 * factor (`levelPowerMult(38) = 2.48`). The point of the construction is that the budget is
 * SATURATED — 38 points already accounted for — so any crit-damage points inference invents push
 * the total past the level ceiling, which is exactly the failure the real hero exhibits.
 */
function ivoSaveHero(): Record<string, unknown> {
  const birth = {
    dmg: 100,
    energia: 100,
    speed: 50,
    crit_chance: 0.05,
    penetration: 1,
    cooldown_reduction: 0.02,
    luck: 0.05,
    crit_dmg: IVO_BIRTH_CRIT_DMG,
  };
  return {
    heroes: [
      {
        id: '21076',
        name: 'Ivo',
        level: IVO_LEVEL,
        stars: 0,
        rarity: 1,
        stat_points_available: 0,
        abilities: Object.entries(IVO_ABILITIES).map(([code, level]) => ({ code, level, max: 20 })),
        birth_stats: birth,
        stats: {
          ...birth,
          dmg: 100 * (1 + 0.04 * (IVO_LEVEL - 1)),
          energia: 100 + IVO_LEVEL * 8,
          crit_dmg: IVO_STATS_CRIT_DMG,
        },
      },
    ],
    items: [],
    skills: { totals: {} },
  } as unknown as Record<string, unknown>;
}

function inferIvo() {
  const hero = extractHero(ivoSaveHero(), 'Ivo', IVO_LEVEL);
  if (!hero.birth) throw new Error('constructed hero must carry birth_stats');
  return inferSpentPoints({
    birth: hero.birth,
    level: hero.level,
    stars: hero.stars,
    sheetOther: hero.sheetOther,
    loadout: hero.loadout,
    tree: treeTotalsFromSave({}),
    sheet: hero.sheet,
    statPointsAvailable: hero.statPointsAvailable,
  });
}

describe('Golpe Brutal is flat — the observation the corpus cannot carry', () => {
  it('recovers 0 crit-damage points — the whole +0.8 belongs to the ability', () => {
    const { pts, issues } = inferIvo();
    expect(pts.critDmg).toBe(0);
    // The residual is not merely small — it is absent, so no `nonIntegerPoints` issue either.
    expect(issues).toEqual([]);
  });

  it('the level ceiling holds: recovered spend does not exceed L38', () => {
    const { pts } = inferIvo();
    const recovered = SHEET_KEYS.reduce((sum, key) => sum + pts[key], 0);
    expect(recovered, `recovered ${recovered} points for a level-${IVO_LEVEL} hero`).toBeLessThanOrEqual(
      IVO_LEVEL,
    );
    expect(recovered, 'the constructed budget is saturated, so the ceiling is a live bound').toBe(
      IVO_LEVEL,
    );
  });
});
