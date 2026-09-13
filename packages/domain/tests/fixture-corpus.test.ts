/**
 * (T9) — the post-patch corpus guard. Mirrors `fixtures-scrubbed.test.ts`'s directory-walk
 * shape. Every assertion here would have been RED on every commit before T8's deletion — that is
 * the point: the corpus guard is written last, once nothing references the old corpus any more.
 *
 * Every red state below has been demonstrated manually (restore one deleted fixture / perturb one
 * byte / add one skip in a scratch state, observe the named failure,
 * revert) — see `docs/fixture-corpus.md` and `docs/validation.md` for the observed messages.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { listFiles } from './helpers/list-files';
import { assertProvenanceComplete, assertRecordedDigests } from './helpers/readme-provenance';
import { SHEET_ABS_TOL } from './helpers/sheet-math-fixtures';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(here, 'fixtures');
const SHEET_MATH_DIR = join(FIXTURES_DIR, 'sheet-math');
const README_PATH = join(SHEET_MATH_DIR, 'README.md');

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}


/**
 * A short, commented allowlist for fixtures read through a computed/templated path rather than a
 * string literal — a literal-only grep is not sufficient (spec Edge Case). Every entry below
 * names the reader. Empty today: every sheet-math fixture is referenced by its literal filename
 * somewhere in packages/domain/tests (verified by the orphan sweep below, which fails loudly if
 * that stops being true).
 */
const COMPUTED_PATH_ALLOWLIST: Record<string, string> = {};

describe('sheet-math fixture corpus guard', () => {
  const sheetMathJsonFiles = readdirSync(SHEET_MATH_DIR).filter((f) => f.endsWith('.json'));

  it('non-vacuity: sheet-math/ has at least 2 committed captures', () => {
    expect(
      sheetMathJsonFiles.length,
      `walked ${SHEET_MATH_DIR}, found ${sheetMathJsonFiles.length} .json files`,
    ).toBeGreaterThanOrEqual(2);
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
    assertProvenanceComplete(README_PATH, sheetMathJsonFiles, 'sheet-math');
  });

  it('committed-file digest: each sheet-math/ file\'s SHA-256 equals the value its README row records', () => {
    assertRecordedDigests(SHEET_MATH_DIR, README_PATH, sheetMathJsonFiles);
  });

  // Scoped to sheet-math/ — the corpus this feature actually manages (the subject is the
  // 17 fixtures orphaned by the quarantined-suite deletion, not a repo-wide fixture audit).
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
