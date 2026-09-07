/**
 * Letter grades never interleave — the build-time check over every committed capture that carries
 * BOTH a hero's stored letter (`rank`) and its roll bounds (`stat_ranges`).
 *
 * WHY THIS SUITE IS DELIBERATELY NOT GATED ON CAPTURE REGIME, unlike its neighbours in this
 * directory. The roll, the bounds and the letter all arrive inside one and the same capture, and
 * every assertion below compares them ONLY against each other — never against this repository's
 * model of the game. A capture taken before a balance patch still carries a self-consistent
 * triple, so it remains a valid subject; adding an expiry gate here would shrink the corpus and
 * buy nothing. Do not "fix" the omission.
 *
 * WHAT IT READS. Committed JSON files, and it does nothing to them but arithmetic. No network, no
 * game process, no generated artifact, no build output.
 *
 * WHY THE ASSERTIONS ARE SHAPED THIS WAY. The game publishes no letter-band table anywhere, and
 * the stored letter is display-only, so `LETTER_BANDS`' cut points are necessarily FITTED to this
 * same corpus. "Every hero lies inside its letter's range" would therefore pass by construction
 * and, after a regrade, fail without saying what moved. The load-bearing claim here is ORDERING
 * instead: no two letters interleave, across the whole corpus. That is a property of the game's
 * grading rather than of a table anyone here chose, so it keeps its meaning after a patch — and a
 * patch that retunes grading breaks it loudly, which is the point of the check.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SheetStats } from '@bombfarm/domain/gear';
import { SHEET_KEYS, ZERO_PTS_TEMPLATE, type SheetKey } from '@bombfarm/domain/planner-constants';
import {
  LETTER_BANDS,
  boundaryCutPoint,
  rollQualityFor,
  type LetterBoundary,
  type RollQualityReport,
} from '@bombfarm/domain/roll-quality';
import { birthFromSave, readStatRanges } from '@bombfarm/domain/save-units';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { isJson, listFiles } from './helpers/list-files';
import { requireFixture } from './helpers/require-fixture';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(here, '..', '..', '..');

/** Every tree in this repository that holds committed captures with heroes in them. */
const FIXTURE_ROOTS = [
  'packages/domain/tests/fixtures',
  'packages/game-api/src/__fixtures__',
  'packages/game-data/fixtures',
  'apps/desktop/tests/fixtures',
] as const;

/**
 * Save key → planner key, NAMES ONLY, mirroring the importer's own projection. Typed over
 * {@link SheetKey} so a statistic added to the sheet fails to compile until it is named here too.
 */
const SAVE_KEY_BY_SHEET_KEY: Record<SheetKey, string> = {
  attack: 'dmg',
  energy: 'energia',
  speed: 'speed',
  penetration: 'penetration',
  critChance: 'crit_chance',
  cdr: 'cooldown_reduction',
  critDmg: 'crit_dmg',
  luck: 'luck',
};

/** The save-side birth-roll key set, derived from the one projection above rather than retyped. */
const SAVE_BIRTH_KEYS: readonly string[] = SHEET_KEYS.map((key) => SAVE_KEY_BY_SHEET_KEY[key]).sort();

/**
 * Floors, not equalities: adding a capture must never require editing this file, but losing one
 * must fail. Measured over the corpus as committed — 19 files, 175 hero entries, 65 distinct
 * heroes after de-duplicating on the eight-float birth-roll signature.
 */
const MIN_CAPTURE_FILES = 19;
const MIN_ENTRIES = 175;
const MIN_DISTINCT_HEROES = 65;

/**
 * Every capture carrying the two fields as of this change, asserted as a SUBSET of what discovery
 * finds. A deletion or a rename fails here; a capture landing later is swept in with no edit, or
 * the dynamic discovery below would be worth nothing.
 */
const EXPECTED_CAPTURE_FILES = [
  'apps/desktop/tests/fixtures/account-offline-caps.json',
  'apps/desktop/tests/fixtures/account-offline.json',
  'packages/domain/tests/fixtures/api/assembled-payload-after.json',
  'packages/domain/tests/fixtures/api/assembled-payload-before.json',
  'packages/domain/tests/fixtures/api/assembled-payload-drift.json',
  'packages/domain/tests/fixtures/api/assembled-payload-partial.json',
  'packages/domain/tests/fixtures/farm-rate/save-20260815-486-7heroes.json',
  'packages/domain/tests/fixtures/fidelity-gate/export-capture.json',
  'packages/domain/tests/fixtures/fidelity-gate/live-capture.json',
  'packages/domain/tests/fixtures/sheet-math/payload-20260812-8heroes.json',
  'packages/domain/tests/fixtures/sheet-math/save-20260813-5heroes.json',
  'packages/domain/tests/fixtures/sheet-math/save-20260818-12heroes.json',
  'packages/domain/tests/fixtures/sheet-math/save-20260819-11882-7heroes.json',
  'packages/domain/tests/fixtures/sheet-math/save-20260819-respec-crit-cdr.json',
  'packages/domain/tests/fixtures/sheet-math/save-20260822-15heroes-tree-crit-dmg.json',
  'packages/domain/tests/fixtures/sheet-math/save-20260823-13heroes-crit-points.json',
  'packages/domain/tests/fixtures/sheet-math/save-20260825-11heroes-one-shot-spread.json',
  'packages/domain/tests/fixtures/sheet-math/save-20260828-4heroes-postpatch.json',
  'packages/domain/tests/fixtures/sheet-math/save-20260831-13heroes-soulbound.json',
] as const;

type SaveHero = {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly rank?: unknown;
  readonly birth_stats?: unknown;
  readonly stat_ranges?: unknown;
};

type CorpusEntry = {
  /** Repo-relative, forward slashes, so a failure message points at a file a reader can open. */
  readonly file: string;
  readonly heroName: string;
  readonly storedLetter: string;
  /** The eight-float birth roll, which is what distinguishes heroes across re-sequenced captures. */
  readonly signature: string;
  readonly raw: SaveHero;
  readonly report: RollQualityReport;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordFromSaveHero(hero: SaveHero): HeroRecord {
  return {
    id: String(hero.id),
    name: String(hero.name),
    updatedAt: 0,
    rarity: 'Comum',
    level: 1,
    stars: 0,
    rank: typeof hero.rank === 'string' ? hero.rank : undefined,
    birth: birthFromSave(isObject(hero.birth_stats) ? hero.birth_stats : {}),
    statRanges: readStatRanges(hero.stat_ranges),
    naked: { ...ZERO_PTS_TEMPLATE } as SheetStats,
    loadout: {},
    altLoadout: null,
    gearedOverride: { ...ZERO_PTS_TEMPLATE } as SheetStats,
    abilities: {},
    pts: { ...ZERO_PTS_TEMPLATE },
  };
}

/** A hero qualifies only when it carries a letter, a birth roll and bounds, and can be scored. */
function entryFor(file: string, hero: SaveHero): CorpusEntry | undefined {
  if (typeof hero.rank !== 'string') return undefined;
  if (!isObject(hero.birth_stats) || !isObject(hero.stat_ranges)) return undefined;
  const report = rollQualityFor(recordFromSaveHero(hero));
  if (report === undefined) return undefined;
  const roll = hero.birth_stats;
  return {
    file,
    heroName: String(hero.name),
    storedLetter: hero.rank,
    signature: SAVE_BIRTH_KEYS.map((key) => String(roll[key])).join('|'),
    raw: hero,
    report,
  };
}

const toPosix = (value: string): string => value.split('\\').join('/');

function discoverCorpus(roots: readonly string[]): CorpusEntry[] {
  const entries: CorpusEntry[] = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const file of listFiles(root, isJson)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        continue;
      }
      const heroes = isObject(parsed) ? parsed.heroes : undefined;
      if (!Array.isArray(heroes)) continue;
      const relativePath = toPosix(relative(REPO_ROOT, file));
      for (const hero of heroes as SaveHero[]) {
        const entry = entryFor(relativePath, hero);
        if (entry !== undefined) entries.push(entry);
      }
    }
  }
  return entries;
}

const CORPUS = discoverCorpus(FIXTURE_ROOTS.map((root) => join(REPO_ROOT, root)));
const DISCOVERED_FILES = [...new Set(CORPUS.map((entry) => entry.file))].sort();

function distinctHeroes(entries: readonly CorpusEntry[]): CorpusEntry[] {
  const bySignature = new Map<string, CorpusEntry>();
  for (const entry of entries) {
    if (!bySignature.has(entry.signature)) bySignature.set(entry.signature, entry);
  }
  return [...bySignature.values()];
}

function boundaryLabel(boundary: LetterBoundary | undefined, absent: string): string {
  if (boundary === undefined) return absent;
  return `${boundary.below}/${boundary.above} in [${boundary.min}, ${boundary.max}], runtime cut ${boundaryCutPoint(boundary).toFixed(4)}`;
}

/**
 * Every failure message routes through here, so each one names the hero, the capture it came from,
 * the stored letter, the computed value, and both neighbouring boundaries. Whoever hits this after
 * a patch months from now has none of the context this change had.
 */
function describeEntry(entry: CorpusEntry): string {
  const index = LETTER_BANDS.letters.indexOf(entry.storedLetter);
  const known = index >= 0;
  const below = known && index > 0 ? LETTER_BANDS.boundaries[index - 1] : undefined;
  const above = known ? LETTER_BANDS.boundaries[index] : undefined;
  return (
    `${entry.heroName} (${entry.file}) stored "${entry.storedLetter}", ` +
    `roll quality ${entry.report.mean.toFixed(6)} → computed "${String(entry.report.computedLetter)}" ` +
    `[below: ${boundaryLabel(below, known ? 'none, lowest letter' : 'unknown to LETTER_BANDS')}] ` +
    `[above: ${boundaryLabel(above, known ? 'none, highest letter' : 'unknown to LETTER_BANDS')}]`
  );
}

const MAX_REPORTED = 8;

function summarize(violations: readonly string[]): string[] {
  if (violations.length <= MAX_REPORTED) return [...violations];
  return [...violations.slice(0, MAX_REPORTED), `…and ${violations.length - MAX_REPORTED} more`];
}

/**
 * The cheap half, and it protects the expensive half: an ordering claim over rolls that were read
 * wrong is worth nothing, so the bounds are checked before they are trusted.
 */
function shapeViolations(entries: readonly CorpusEntry[]): string[] {
  const violations: string[] = [];
  for (const entry of entries) {
    const roll = entry.raw.birth_stats as Record<string, unknown>;
    const bounds = entry.raw.stat_ranges as Record<string, unknown>;
    const rollKeys = Object.keys(roll).sort();
    const boundsKeys = Object.keys(bounds).sort();
    if (rollKeys.join(',') !== SAVE_BIRTH_KEYS.join(',')) {
      violations.push(
        `${describeEntry(entry)} — birth roll carries [${rollKeys.join(', ')}], expected the eight birth-roll keys [${SAVE_BIRTH_KEYS.join(', ')}]`,
      );
    }
    if (boundsKeys.join(',') !== rollKeys.join(',')) {
      violations.push(
        `${describeEntry(entry)} — bounds carry [${boundsKeys.join(', ')}] but the birth roll carries [${rollKeys.join(', ')}]`,
      );
    }
    for (const key of SAVE_BIRTH_KEYS) {
      const band = bounds[key];
      if (!isObject(band)) {
        violations.push(`${describeEntry(entry)} — bound "${key}" is not an object: ${JSON.stringify(band)}`);
        continue;
      }
      const { min, max } = band;
      if (typeof min !== 'number' || !Number.isFinite(min) || typeof max !== 'number' || !Number.isFinite(max)) {
        violations.push(
          `${describeEntry(entry)} — bound "${key}" has a non-finite endpoint: min=${JSON.stringify(min)} max=${JSON.stringify(max)}`,
        );
        continue;
      }
      if (max < min) {
        violations.push(`${describeEntry(entry)} — bound "${key}" is inverted: min=${min} max=${max}`);
      }
    }
    for (const key of SHEET_KEYS) {
      const stat = entry.report.perStat[key];
      if (stat.percentile === undefined) {
        violations.push(
          `${describeEntry(entry)} — "${key}" could not be placed inside its band (${String(stat.unavailableReason)})`,
        );
      } else if (stat.outOfBand === true) {
        violations.push(
          `${describeEntry(entry)} — "${key}" rolled ${String(stat.value)} outside its own band [${String(stat.band?.min)}, ${String(stat.band?.max)}]`,
        );
      }
    }
  }
  return summarize(violations);
}

/**
 * THE LOAD-BEARING ASSERTION. Every hero of a letter must score strictly above every hero of the
 * letter below it, over the whole corpus and not merely within a capture. Unlike a cut point,
 * this claim cannot be fitted to the data — it either holds of the game's grading or it does not.
 */
function orderingInversions(entries: readonly CorpusEntry[]): string[] {
  const ranked = entries.map((entry) => ({ entry, index: LETTER_BANDS.letters.indexOf(entry.storedLetter) }));
  const violations: string[] = [];
  for (const lower of ranked) {
    if (lower.index < 0) continue;
    for (const higher of ranked) {
      if (higher.index <= lower.index) continue;
      if (lower.entry.report.mean < higher.entry.report.mean) continue;
      violations.push(
        `letters interleave — ${describeEntry(lower.entry)} does not score below ${describeEntry(higher.entry)}`,
      );
    }
  }
  return summarize(violations);
}

/**
 * The boundaries are only ever asserted to be CONSISTENT with the evidence, never located by it:
 * each one must fall strictly inside the empty gap between the two letters it separates. Anything
 * stronger would be checking the fit against the data it was fitted to.
 */
function boundariesOutsideTheirGap(
  entries: readonly CorpusEntry[],
  boundaries: readonly LetterBoundary[],
): string[] {
  const violations: string[] = [];
  for (const boundary of boundaries) {
    const below = entries.filter((entry) => entry.storedLetter === boundary.below);
    const above = entries.filter((entry) => entry.storedLetter === boundary.above);
    if (below.length === 0 || above.length === 0) {
      violations.push(
        `boundary ${boundary.below}/${boundary.above} has no observable gap: ${below.length} entries graded "${boundary.below}", ${above.length} graded "${boundary.above}"`,
      );
      continue;
    }
    const topOfLower = below.reduce((a, b) => (b.report.mean > a.report.mean ? b : a));
    const bottomOfUpper = above.reduce((a, b) => (b.report.mean < a.report.mean ? b : a));
    const gapLow = topOfLower.report.mean;
    const gapHigh = bottomOfUpper.report.mean;
    const gap = `(${gapLow.toFixed(6)}, ${gapHigh.toFixed(6)})`;
    const context =
      `top of "${boundary.below}": ${describeEntry(topOfLower)}; ` +
      `bottom of "${boundary.above}": ${describeEntry(bottomOfUpper)}`;
    const cut = boundaryCutPoint(boundary);
    if (!(gapLow < cut && cut < gapHigh)) {
      violations.push(
        `the runtime cut point ${cut.toFixed(6)} for ${boundary.below}/${boundary.above} is not strictly inside the observed gap ${gap} — ${context}`,
      );
    }
    if (!(boundary.min >= gapLow && boundary.max <= gapHigh)) {
      violations.push(
        `the recorded interval [${boundary.min}, ${boundary.max}] for ${boundary.below}/${boundary.above} reaches outside the observed gap ${gap} — ${context}`,
      );
    }
  }
  return summarize(violations);
}

/**
 * A check that goes quiet when a fixture refresh drops `rank` or `stat_ranges` is worthless, so
 * an empty or shrunken corpus is a FAILURE and never a pass.
 */
function vacuityFailures(entries: readonly CorpusEntry[], files: readonly string[]): string[] {
  const failures: string[] = [];
  if (files.length < MIN_CAPTURE_FILES) {
    failures.push(
      `only ${files.length} capture files carry both a letter and roll bounds, expected at least ${MIN_CAPTURE_FILES}`,
    );
  }
  if (entries.length < MIN_ENTRIES) {
    failures.push(`only ${entries.length} hero entries qualified, expected at least ${MIN_ENTRIES}`);
  }
  const distinct = distinctHeroes(entries);
  if (distinct.length < MIN_DISTINCT_HEROES) {
    failures.push(
      `only ${distinct.length} distinct heroes after de-duplicating on the birth roll, expected at least ${MIN_DISTINCT_HEROES}`,
    );
  }
  for (const letter of LETTER_BANDS.letters) {
    const seen = distinct.filter((entry) => entry.storedLetter === letter).length;
    if (seen === 0) failures.push(`no distinct hero in the corpus carries the letter "${letter}"`);
  }
  for (const entry of entries) {
    if (!LETTER_BANDS.letters.includes(entry.storedLetter)) {
      failures.push(`${describeEntry(entry)} — stored letter is unknown to LETTER_BANDS, so ordering silently skips it`);
    }
  }
  return summarize(failures);
}

/** Deep-clones one capture's hero so every red state starts from an untouched copy. */
function cloneHero(hero: SaveHero): Record<string, unknown> {
  return JSON.parse(JSON.stringify(hero)) as Record<string, unknown>;
}

function rebuild(hero: Record<string, unknown>, file: string): CorpusEntry {
  const entry = entryFor(file, hero as SaveHero);
  if (entry === undefined) throw new Error(`the doctored hero no longer qualifies for the corpus: ${file}`);
  return entry;
}

const LOWEST_SCORING = CORPUS.length === 0 ? undefined : CORPUS.reduce((a, b) => (b.report.mean < a.report.mean ? b : a));

describe('the letter-grade corpus is discovered, not hand-listed', () => {
  it('every fixture root this check sweeps is present', () => {
    for (const root of FIXTURE_ROOTS) {
      requireFixture(join(REPO_ROOT, root), `letter-grade corpus sweep of ${root}`);
    }
  });

  it('every capture known to carry a letter and roll bounds is still discovered', () => {
    for (const expected of EXPECTED_CAPTURE_FILES) {
      expect(DISCOVERED_FILES, `capture missing from discovery: ${expected}`).toContain(expected);
    }
  });

  it('non-vacuity: the corpus is large enough, and every letter is represented', () => {
    expect(vacuityFailures(CORPUS, DISCOVERED_FILES)).toEqual([]);
  });
});

describe('the corpus is shaped the way the roll-quality model assumes', () => {
  it('bounds and birth rolls carry the same eight keys, every band is finite and ordered, and every roll lies inside its own band', () => {
    expect(shapeViolations(CORPUS)).toEqual([]);
  });
});

describe('letter grades never interleave', () => {
  it('every hero of a letter scores above every hero of the letter below, across the whole corpus', () => {
    expect(orderingInversions(CORPUS)).toEqual([]);
  });
});

describe('every runtime boundary is consistent with the gap it sits in', () => {
  it('falls strictly inside the empty interval between the two letters it separates', () => {
    expect(boundariesOutsideTheirGap(CORPUS, LETTER_BANDS.boundaries)).toEqual([]);
  });
});

describe('each clause can fail — a doctored corpus, discarded', () => {
  it('shape: a non-finite bound is reported against the hero that carries it', () => {
    const subject = CORPUS[0];
    expect(subject, 'the corpus is empty, so no red state can be demonstrated').toBeDefined();
    const doctored = cloneHero(subject.raw);
    (((doctored.stat_ranges as Record<string, unknown>).dmg) as Record<string, unknown>).max = null;
    const violations = shapeViolations([rebuild(doctored, subject.file)]);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.join('\n')).toContain(subject.heroName);
    expect(violations.join('\n')).toContain('non-finite endpoint');
  });

  it('shape: a roll pushed outside its own band is reported against the hero that carries it', () => {
    const subject = CORPUS[0];
    expect(subject).toBeDefined();
    const doctored = cloneHero(subject.raw);
    const band = (doctored.stat_ranges as Record<string, { max: number }>).luck;
    (doctored.birth_stats as Record<string, number>).luck = band.max * 10;
    const violations = shapeViolations([rebuild(doctored, subject.file)]);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.join('\n')).toContain(subject.heroName);
    expect(violations.join('\n')).toContain('outside its own band');
  });

  it('ordering: a hero whose rolls cross a band edge is reported as an interleave', () => {
    const subject = LOWEST_SCORING;
    expect(subject, 'the corpus is empty, so no red state can be demonstrated').toBeDefined();
    if (subject === undefined) return;
    const doctored = cloneHero(subject.raw);
    const bounds = doctored.stat_ranges as Record<string, { min: number; max: number }>;
    const roll = doctored.birth_stats as Record<string, number>;
    for (const key of SAVE_BIRTH_KEYS) roll[key] = bounds[key].max;
    const violations = orderingInversions([...CORPUS.filter((entry) => entry !== subject), rebuild(doctored, subject.file)]);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.join('\n')).toContain(subject.heroName);
    expect(violations.join('\n')).toContain('letters interleave');
  });

  it('boundary: a cut point moved out of its gap is reported with both edges of that gap', () => {
    const [firstBoundary] = LETTER_BANDS.boundaries;
    const moved: LetterBoundary = { ...firstBoundary, min: 0, max: 1 };
    const violations = boundariesOutsideTheirGap(CORPUS, [moved]);
    expect(violations.join('\n')).toContain('is not strictly inside the observed gap');
    expect(violations.join('\n')).toContain(`${firstBoundary.below}/${firstBoundary.above}`);
  });

  it('boundary: an interval widened past the observed gap is reported even when its cut point still lands inside', () => {
    const [firstBoundary] = LETTER_BANDS.boundaries;
    const widened: LetterBoundary = {
      ...firstBoundary,
      min: firstBoundary.min - 0.5,
      max: firstBoundary.max + 0.5,
    };
    const violations = boundariesOutsideTheirGap(CORPUS, [widened]);
    expect(violations.join('\n')).toContain('reaches outside the observed gap');
    expect(violations.join('\n')).not.toContain('is not strictly inside the observed gap');
  });

  it('non-vacuity: discovery pointed at a tree that does not exist fails rather than passing on an empty set', () => {
    const nowhere = discoverCorpus([join(REPO_ROOT, 'packages/domain/tests/fixtures-that-do-not-exist')]);
    expect(nowhere).toEqual([]);
    const failures = vacuityFailures(nowhere, []);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.join('\n')).toContain('only 0 hero entries qualified');
  });
});
