/**
 * MP5 F1 (T9) — the post-patch corpus guard. Mirrors `fixtures-scrubbed.test.ts`'s directory-walk
 * shape. Every assertion here would have been RED on every commit before T8's deletion — that is
 * the point: the corpus guard is written last, once nothing references the old corpus any more.
 *
 * Every red state below has been demonstrated manually (restore one deleted fixture / perturb one
 * byte / add one skip / add one keystone reference in a scratch state, observe the named failure,
 * revert) — see `docs/fixture-corpus.md` and `validation.md` for the observed messages.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { SHEET_ABS_TOL } from './helpers/sheet-math-fixtures';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(here, 'fixtures');
const SHEET_MATH_DIR = join(FIXTURES_DIR, 'sheet-math');
const README_PATH = join(SHEET_MATH_DIR, 'README.md');

const FORBIDDEN_KEYS = ['keystones', 'abisso_base', 'crit_dmg_mult'] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function listFiles(dir: string, predicate: (name: string) => boolean, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      listFiles(full, predicate, acc);
    } else if (entry.isFile() && predicate(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/**
 * A short, commented allowlist for fixtures read through a computed/templated path rather than a
 * string literal — a literal-only grep is not sufficient (spec Edge Case). Every entry below
 * names the reader. Empty today: every sheet-math fixture is referenced by its literal filename
 * somewhere in packages/domain/tests (verified by the orphan sweep below, which fails loudly if
 * that stops being true).
 */
const COMPUTED_PATH_ALLOWLIST: Record<string, string> = {};

describe('sheet-math fixture corpus guard (MP5 F1)', () => {
  const sheetMathJsonFiles = readdirSync(SHEET_MATH_DIR).filter((f) => f.endsWith('.json'));
  const allFixtureJsonFiles = listFiles(FIXTURES_DIR, (name) => name.endsWith('.json'));

  it('non-vacuity: sheet-math/ has at least 2 committed captures', () => {
    expect(
      sheetMathJsonFiles.length,
      `walked ${SHEET_MATH_DIR}, found ${sheetMathJsonFiles.length} .json files`,
    ).toBeGreaterThanOrEqual(2);
  });

  it('negative discriminator: no fixture JSON under fixtures/** carries keystones, abisso_base or crit_dmg_mult (MP5 F4: except its own deliberate rejection fixture)', () => {
    expect(allFixtureJsonFiles.length, `walked ${FIXTURES_DIR}`).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of allFixtureJsonFiles) {
      // MP5 F4 (`MSG-12`/`MSG-13`): `fixtures/rejection/pre-update-save.json` is a DELIBERATE
      // carrier of the retired vocabulary — it exists specifically to prove `parseSaveFile`
      // rejects a save shaped like this. It is not a captured corpus member this guard's
      // "the corpus has moved on" claim is about; excluded the same way `source-surface.test.ts`'s
      // own TESTS_ALLOWLIST names a justified carrier rather than widening its pattern.
      if (relative(FIXTURES_DIR, file).replace(/\\/g, '/') === 'rejection/pre-update-save.json') continue;
      const text = readFileSync(file, 'utf8');
      for (const key of FORBIDDEN_KEYS) {
        if (text.includes(`"${key}"`)) {
          offenders.push(`${relative(FIXTURES_DIR, file)} (carries "${key}")`);
        }
      }
    }
    expect(offenders, `offending fixtures:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('positive discriminator: every sheet-math/ fixture carries >=1 of skills.refunds / skills.totals.vagas_campo / skills.totals.bag_tabs_bonus, on the parsed object', () => {
    const offenders: string[] = [];
    for (const file of sheetMathJsonFiles) {
      const parsed: unknown = JSON.parse(readFileSync(join(SHEET_MATH_DIR, file), 'utf8'));
      const skills = isObject(parsed) && isObject(parsed.skills) ? parsed.skills : {};
      const totals = isObject(skills.totals) ? skills.totals : {};
      const hasRefunds = skills.refunds !== undefined;
      const hasVagasCampo = totals.vagas_campo !== undefined;
      const hasBagTabsBonus = totals.bag_tabs_bonus !== undefined;
      if (!hasRefunds && !hasVagasCampo && !hasBagTabsBonus) {
        offenders.push(file);
      }
    }
    expect(
      offenders,
      `fixtures missing every positive-discriminator key (checked on the parsed object, not a substring): ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('provenance completeness, both directions: every sheet-math/ file has a README row, every row names a file that exists', () => {
    const readmeText = readFileSync(README_PATH, 'utf8');
    const headingMatches = [...readmeText.matchAll(/^## `([^`]+)`$/gm)].map((m) => m[1]);
    const namedFiles = new Set(headingMatches);

    const dataFiles = sheetMathJsonFiles; // README.md itself is not a data file
    const missingRows = dataFiles.filter((f) => !namedFiles.has(f));
    const danglingRows = headingMatches.filter((f) => !dataFiles.includes(f));

    expect(missingRows, `sheet-math files with no README row: ${missingRows.join(', ')}`).toEqual([]);
    expect(danglingRows, `README rows naming a file that does not exist: ${danglingRows.join(', ')}`).toEqual([]);
  });

  it('committed-file digest: each sheet-math/ file\'s SHA-256 equals the value its README row records', () => {
    const readmeText = readFileSync(README_PATH, 'utf8');
    const sections = readmeText.split(/^## /m).slice(1);
    const recordedByFile = new Map<string, string>();
    for (const section of sections) {
      const nameMatch = section.match(/^`([^`]+)`/);
      const shaMatch = section.match(/SHA-256 \(committed file\) \| `([0-9a-f]{64})`/);
      if (nameMatch && shaMatch) recordedByFile.set(nameMatch[1], shaMatch[1]);
    }
    const mismatches: string[] = [];
    for (const file of sheetMathJsonFiles) {
      const recorded = recordedByFile.get(file);
      expect(recorded, `${file} has no parsable SHA-256 (committed file) row`).toBeDefined();
      const actual = sha256(join(SHEET_MATH_DIR, file));
      if (actual !== recorded) mismatches.push(`${file}: recorded ${recorded}, actual ${actual}`);
    }
    expect(mismatches, mismatches.join('\n')).toEqual([]);
  });

  // Scoped to sheet-math/ — the corpus this feature actually manages (MFR-04's subject is the
  // 17 fixtures orphaned by the quarantined-suite deletion, not a repo-wide fixture audit).
  // `fixtures/i18n-strings-main.json` and `fixtures/storage-roundtrip-20260729.json` are
  // pre-existing, unrelated fixtures with zero domain-side consumers (only apps/web's own
  // separate copies are read) — a condition that predates this feature and is out of its scope.
  it('orphan sweep: every sheet-math/ fixture is named by >=1 live test source in this package (basename or stem), or is in the commented allowlist', () => {
    const testSourceFiles = listFiles(
      here,
      (name) => name.endsWith('.test.ts') && name !== 'fixture-corpus.test.ts',
    );
    expect(testSourceFiles.length, `walked ${here} for *.test.ts`).toBeGreaterThan(0);

    const sourceTextByFile = new Map(testSourceFiles.map((f) => [f, readFileSync(f, 'utf8')]));

    const orphans: string[] = [];
    for (const file of sheetMathJsonFiles) {
      const stem = file.replace(/\.json$/, '');
      if (COMPUTED_PATH_ALLOWLIST[file]) continue;
      const referenced = [...sourceTextByFile.values()].some(
        (text) => text.includes(file) || text.includes(stem),
      );
      if (!referenced) orphans.push(file);
    }
    expect(
      orphans,
      `orphaned sheet-math fixtures (no live test source names them, and no allowlist entry): ${orphans.join(', ')}`,
    ).toEqual([]);
  });

  it('tolerance parity: Object.keys(SHEET_ABS_TOL) equals SHEET_KEYS (the deleted sheet-math-fixtures.test.ts tolerance smoke, restated live)', () => {
    expect(Object.keys(SHEET_ABS_TOL).sort()).toEqual([...SHEET_KEYS].sort());
  });
});
