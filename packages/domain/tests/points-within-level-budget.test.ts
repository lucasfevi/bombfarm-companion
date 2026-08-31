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
 *    without editing this file. Which captures are ADMISSIBLE is likewise not decided here: it is
 *    read off the corpus-wide registry in `helpers/capture-regime.ts`.
 * 2. **The Golpe Brutal case** — three witnesses now, two in the corpus and one constructed.
 *
 *    The corpus ones are Buff S #1 (L85 ★0, `stat_points_available: 0`, Golpe Brutal 20/20) in
 *    `sheet-math/save-20260823-13heroes-crit-points.json`, and Ivo (L51, 20/20) in
 *    `sheet-math/save-20260819-11882-7heroes.json`. Both budgets are saturated, so layer 1 DOES
 *    exercise this bug: modelling the ability as anything other than +4 flat per rank charges the
 *    difference to crit-damage points and the sweep goes red (measured — dropping the ability to
 *    zero recovers 101 points on the L85 hero). An earlier version of this comment claimed no
 *    committed capture carried the ability at all; that was already false when written, and is the
 *    reason the claim is now asserted rather than described.
 *
 *    The constructed one is Ivo again — the same hero, four days earlier at L38, reconstructed —
 *    kept because neither corpus witness ISOLATES the observation. Buff S #1's crit-damage move
 *    needs the tree's `crit_dmg_add` subtracted before the flat +0.8 appears, and the committed
 *    Ivo wears eight items. The constructed one carries no gear and no other sheet ability, so the
 *    whole delta is the ability, and it survives the corpus changing under it. All three use save
 *    units and the game's own reading, not this model's output — the practice
 *    `save-units.test.ts` uses for Bellatrix's `crit_dmg` literal.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { inferSpentPoints } from '@bombfarm/domain/point-inference';
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { capturesOutOfRegimeFor, isInRegimeFor } from './helpers/capture-regime';
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
 * Captures whose sheet shape does not match the CURRENT game. This used to be a list maintained
 * here by hand, re-derived at every patch; it is now DERIVED from the corpus-wide registry in
 * `helpers/capture-regime.ts` (issue #137), which is the single place the boundaries are written
 * down and which fails if a committed capture has no declared regime at all.
 *
 * `'sheet'` is the mechanic this invariant asks for, and it is the strictest one: layer 1 reads a
 * whole composed hero sheet, so it folds in every boundary — the 2026-08-15 flat crit/cooldown
 * window and its 2026-08-18 revert, the 2026-08-16 item redistribution, and the 2026-08-23
 * restatement of the crit abilities into flat points.
 *
 * Excluded captures all stay committed — ~50 structural suites read them for hero shapes,
 * inventory and team-plan inputs, none of which any patch touched — but none of them are subjects
 * of THIS invariant, because no single model can reproduce a mix of regimes at once. Sweeping them
 * here would assert that today's sheet math explains a different regime's game.
 *
 * A capture added later is swept BY DEFAULT: the registry judges it by its own capture date, so
 * nothing has to be edited here for a fresh capture to become a subject, and an old one cannot be
 * swept by omission.
 */
const NON_CURRENT_REGIME_CAPTURES = capturesOutOfRegimeFor('sheet');

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
   * Non-vacuity. The 2026-08-28 damage boundary had taken the swept set from three captures and
   * 31 heroes down to ONE and four — every earlier capture has an equipped weapon, and the weapon
   * 5x reaches all of them, so none could back a `sheet` number any more. The prediction recorded
   * here was that the sweep would recover on the first post-boundary capture with a geared roster.
   * It has: the 2026-08-31 capture adds 13 heroes, eleven of them geared, and all 13 satisfy the
   * budget on the current damage model.
   *
   * The per-file breakdown is asserted, not just the total: a total alone would stay green if one
   * capture stopped being swept while another grew, which is the failure this guard exists for.
   */
  it('non-vacuity: the walk finds every in-regime capture, with heroes in them', () => {
    const byFile = new Map<string, number>();
    for (const s of SUBJECTS) byFile.set(s.file, (byFile.get(s.file) ?? 0) + 1);
    expect(Object.fromEntries([...byFile].sort()), `walked ${FIXTURES_DIR}`).toEqual({
      'sheet-math/save-20260828-4heroes-postpatch.json': 4,
      'sheet-math/save-20260831-13heroes-soulbound.json': 13,
    });
    expect(SUBJECTS.length).toBe(17);
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
  blocked: boolean;
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
        blocked: candidate.blocked,
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
   * The other half of the same statement: the heroes this guard cannot vouch for are counted, not
   * silently dropped.
   *
   * RESTATED once the importer began REFUSING an over-budget vector. Before that, a hero today's
   * math could not invert still carried its illegal spend on the record, so this counted those.
   * Now it is blocked and its vector is zeroed, so counting over-spends here would find none and
   * the assertion would quietly become vacuous — it went red on exactly that, which is the guard
   * doing its job. The countable population is now the BLOCKED heroes, and the claim is the same
   * one: the corpus still holds captures today's model cannot read, and not one of them reaches a
   * record with an illegal vector on it.
   */
  it('the heroes it cannot vouch for are blocked, and none of them keeps a vector', () => {
    const unreadable = IMPORTED.filter((hero) => hero.blocked);
    expect(unreadable.length, 'heroes the importer refused, over the whole fixture tree').toBeGreaterThan(0);
    const kept = unreadable
      .filter((hero) => hero.spent > 0)
      .map((hero) => `${hero.file} → ${hero.name}: ${hero.spent} points`);
    expect(kept, 'blocked heroes that still carry a spent-point vector').toEqual([]);
    // And nothing that DID import is over its level — the same claim as the assertion above,
    // restated over the complement so the two together cover every hero the walk sees.
    const imported = IMPORTED.filter((hero) => !hero.blocked && hero.spent > hero.level);
    expect(imported, 'unblocked heroes above their level').toEqual([]);
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

/**
 * Buff S #1, id in `sheet-math/save-20260823-13heroes-crit-points.json` — the corpus witness.
 * L85 ★0, `stat_points_available: 0`, Golpe Brutal 20/20, plus Misericordia and Fôlego de
 * Mineiro (an execute threshold and a drain rate: neither touches the sheet). `GearBonuses`
 * carries no crit-damage term at all, and the hero is ★0, so this column admits exactly three
 * contributors beyond birth: the tree, the ability, and crit-damage stat points.
 */
const BUFF_S_CAPTURE = 'sheet-math/save-20260823-13heroes-crit-points.json';
const BUFF_S_NAME = 'Buff S #1';
const BUFF_S_RANKS = 20;

function buffSCapture(): Record<string, unknown> {
  const raw: unknown = JSON.parse(readFileSync(join(FIXTURES_DIR, ...BUFF_S_CAPTURE.split('/')), 'utf8'));
  if (!isObject(raw)) throw new Error(`${BUFF_S_CAPTURE} is not an object`);
  return raw;
}

describe('Golpe Brutal is flat — the corpus witness', () => {
  it('the capture still carries the ability on a saturated hero, so layer 1 sweeps it', () => {
    const raw = buffSCapture();
    const heroes = (raw.heroes as Array<Record<string, unknown>>).filter(
      (hero) => (hero.abilities as Array<{ code: string; level: number }>).some(
        (ability) => ability.code === 'golpe_brutal' && ability.level > 0,
      ),
    );
    expect(heroes.map((hero) => hero.name), `${BUFF_S_CAPTURE} golpe_brutal owners`).toEqual([BUFF_S_NAME]);
    const [hero] = heroes;
    expect(hero.stars, 'stars — no star rescale on this column').toBe(0);
    expect(hero.stat_points_available, 'a saturated budget is what makes the ceiling a live bound').toBe(0);
    // Names the mechanic this claim actually rests on. The capture left the `sheet` regime at the
    // 2026-08-28 damage boundary, so it no longer feeds the sweep above — but Golpe Brutal's
    // arithmetic below reads birth, stats and the tree straight off the capture and never touches
    // the item catalog, which is why crit damage is the right question and `sheet` is not.
    expect(isInRegimeFor(BUFF_S_CAPTURE, 'critDamage'), `${BUFF_S_CAPTURE} crit-damage regime`).toBe(true);
  });

  it('the whole crit-damage move is the tree plus 20 ranks × 4 flat, with nothing left over', () => {
    const raw = buffSCapture();
    const totals = (raw.skills as { totals: Record<string, number> }).totals;
    const hero = (raw.heroes as Array<Record<string, unknown>>).find((h) => h.name === BUFF_S_NAME)!;
    const birth = (hero.birth_stats as Record<string, number>).crit_dmg;
    const observed = (hero.stats as Record<string, number>).crit_dmg - birth;
    const residual = observed - totals.crit_dmg_add;
    // Percent-of-base would put `20 × 0.04 × birth` here — `0.8 × 1.731…`, off by 58%.
    expect(residual, `${observed} moved, minus ${totals.crit_dmg_add} of tree`).toBeCloseTo(
      (BUFF_S_RANKS * 4) / 100,
      9,
    );
    expect(residual).not.toBeCloseTo(((BUFF_S_RANKS * 4) / 100) * birth, 3);
  });

  it('inference charges none of it to stat points, and the L85 budget stays inside its ceiling', () => {
    const raw = buffSCapture();
    const hero = extractHero(raw, BUFF_S_NAME);
    if (!hero.birth) throw new Error(`${BUFF_S_NAME} must carry birth_stats`);
    const totalsRaw = (raw.skills as { totals: Record<string, unknown> }).totals;
    const { pts } = inferSpentPoints({
      birth: hero.birth,
      level: hero.level,
      stars: hero.stars,
      sheetOther: hero.sheetOther,
      loadout: hero.loadout,
      tree: treeTotalsFromSave(totalsRaw),
      sheet: hero.sheet,
      statPointsAvailable: hero.statPointsAvailable,
    });
    expect(pts.critDmg, 'crit-damage points recovered for a hero that spent none').toBe(0);
    const recovered = SHEET_KEYS.reduce((sum, key) => sum + pts[key], 0);
    expect(recovered, `recovered ${recovered} points for L${hero.level}`).toBeLessThanOrEqual(hero.level);
  });
});

describe('Golpe Brutal is flat — the isolated construction', () => {
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
