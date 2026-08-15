/**
 * MP5 F2 (T10, `AD-073`) — the absence guard. Makes MKR-10 and MKR-21 machine-checkable, and is
 * the ONLY mechanism that can catch a stale removed-arm property in an untypechecked test file:
 * `packages/domain/tsconfig.typecheck.json` covers six `fidelity-*` files, and esbuild silently
 * drops excess object-literal properties at runtime, so a stale property on the other 53 test
 * files would compile, run, and pass.
 *
 * A literal zero-matches assertion over `packages/domain/tests` is unreachable (MKR-16 forbids
 * editing any fixture, and two carriers under `fixtures/` belong to F3's still-shipping web
 * surface; two more are F1's own guard and its manifest, which must name the forbidden keys to
 * forbid them; MP5 F4 adds one more — its own purpose-built rejection fixture, which must contain
 * the retired fields verbatim). This suite pins an exact PER-FILE map instead of a bare count — a
 * count-only check would miss a match moving from an allowlisted file to a new one while the sum
 * holds.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const DOMAIN_ROOT = join(here, '..');
const SRC_ROOT = join(DOMAIN_ROOT, 'src');
const TESTS_ROOT = join(DOMAIN_ROOT, 'tests');

/**
 * This guard's own implementation necessarily contains the pattern it matches against (as
 * source code, in its own explanatory prose, and in this file's name check) — a linter does
 * not lint its own rule definition. Self-excluded from both scans below, not allowlisted:
 * the exclusion is structural, not a carve-out for stale content.
 */
const SELF_FILENAME = 'source-surface.test.ts';

/**
 * `packages/domain/src` pattern (AC-10 / MKR-10) — deliberately case-insensitive and singular
 * `keystone`, so it also catches a stale cross-reference to the name of a deleted test file
 * (MKR-31). Includes the bare `critDmgMult` identifier, whose ONLY surviving occurrences are
 * the pinned 12-line combat pass-through (design §2.5) — everything else naming it was deleted.
 */
const SRC_PATTERN =
  /keystone|abisso|glass.?cannon|tempo.?dobrado|critDmgMult|crit_dmg_mult|abissoBase|abisso_base/i;

/**
 * `packages/domain/tests` pattern (MKR-21, spec.md P1 AC-3) — the SAME token set MINUS the bare
 * `critDmgMult` identifier. Every surviving suite legitimately keeps `critDmgMult: 1` /
 * `critDmgMult: mults.critDmgMult` (MKR-22, MKR-26) across many files — that pass-through is
 * combat-layer content, not deleted-arm content, and spec.md's own MKR-21 AC-3 pattern never
 * included the bare identifier in the first place.
 */
const TESTS_PATTERN = /keystone|abisso|glass.?cannon|tempo.?dobrado|crit_dmg_mult|abissoBase|abisso_base/i;

const SKIP_PATTERN = /\.skip\(|\.todo\(|\bxit\(|\bxdescribe\(/;

function listFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      listFiles(full, acc);
    } else if (entry.isFile()) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * `packages/domain/src` — the surviving `critDmgMult` combat pass-through (design §2.5). Every
 * deleted-arm term is gone; this always-`1` chain is the one keystone-shaped identifier the
 * spec's own Assumption keeps (removing it would be an unrelated public-signature change to
 * `derive()`). Re-measured against the tree at every T5-T9 commit, not copied from a document.
 */
const SRC_ALLOWLIST: Record<string, number[]> = {
  'derive.ts': [27, 78, 96, 142, 197, 208],
  // Line numbers only — the matches are unchanged in count and in kind; the House-cycle
  // plumbing (`houseCycleSecs` on the input type + its two use sites) inserted lines above them
  // and shifted all four down. The House-ceiling regression repair (PR #86 finding, house.ts:38)
  // added `houseCycleSecsHouseIdx`/`houseCycleSecsLevel` alongside it (destructured local +
  // input type + `farmContextForHero` call site) and shifted all four down again.
  'advisor-pipeline.ts': [104, 210, 239, 341],
  'stat-breakdown/types.ts': [105],
  // +1 (line number only): the `cycleSecs` pass-through added one line above this hit.
  // +2 more: the House-ceiling regression repair's `cycleSecsHouseIdx`/`cycleSecsLevel`
  // pass-through (PR #86 finding, house.ts:38) added two more lines above it.
  'team-plan/score.ts': [138],
};

/**
 * `packages/domain/tests` — five files outside F2's reach, each commented with its owner:
 * - `fixtures/i18n-strings-main.json`, `fixtures/storage-roundtrip-20260729.json`: F3's web
 *   i18n / storage-roundtrip snapshots, living inside `fixtures/`, which MKR-16 forbids editing.
 * - `fixtures/sheet-math/README.md`: F1's provenance manifest, which must name the forbidden
 *   keys to forbid them.
 * - `fixture-corpus.test.ts`: F1's own corpus guard, whose `FORBIDDEN_KEYS` array must contain
 *   the literal key names to function.
 * - `fixtures/rejection/pre-update-save.json`: F4's own purpose-built rejection fixture
 *   (`MSG-12`/`MSG-13`, `packages/domain/tests/save-acceptance.test.ts`) — it must contain the
 *   retired fields verbatim to prove `parseSaveFile` rejects a save shaped like this. Its sibling
 *   `truncated-save.json` carries none of them (an empty `skills.totals`) and needs no entry.
 */
const TESTS_ALLOWLIST: Record<string, number> = {
  'fixtures/i18n-strings-main.json': 24,
  'fixtures/storage-roundtrip-20260729.json': 1,
  'fixtures/sheet-math/README.md': 2,
  'fixture-corpus.test.ts': 3,
  'fixtures/rejection/pre-update-save.json': 3,
};

function matchingLines(absPath: string, pattern: RegExp): number[] {
  const text = readFileSync(absPath, 'utf8');
  const lines = text.split(/\r?\n/);
  const hits: number[] = [];
  lines.forEach((line, index) => {
    if (pattern.test(line)) hits.push(index + 1);
  });
  return hits;
}

describe('source-surface — the deleted-arm absence guard (MP5 F2 T10, AD-073)', () => {
  const srcFiles = listFiles(SRC_ROOT);
  const testFiles = listFiles(TESTS_ROOT).filter((f) => !f.endsWith(SELF_FILENAME));

  it('non-vacuity: the scan roots are non-empty and meet a committed floor', () => {
    expect(srcFiles.length, `scanned ${SRC_ROOT}`).toBeGreaterThanOrEqual(50);
    expect(testFiles.length, `scanned ${TESTS_ROOT}`).toBeGreaterThanOrEqual(50);
  });

  it('packages/domain/src: the pattern matches exactly the pinned per-file, per-line allowlist (MKR-10)', () => {
    const actual: Record<string, number[]> = {};
    for (const file of srcFiles) {
      const rel = relative(SRC_ROOT, file).split('\\').join('/');
      const hits = matchingLines(file, SRC_PATTERN);
      if (hits.length > 0) actual[rel] = hits;
    }

    const expectedFiles = Object.keys(SRC_ALLOWLIST).sort();
    const actualFiles = Object.keys(actual).sort();
    expect(actualFiles, 'unexpected file(s) with a match, or an allowlisted file with none').toEqual(expectedFiles);

    for (const file of expectedFiles) {
      expect(actual[file], `${file}: matched lines`).toEqual(SRC_ALLOWLIST[file]);
    }
  });

  it('packages/domain/tests: the pattern matches exactly the four allowlisted files, with their exact counts (MKR-21, AD-073)', () => {
    const actual: Record<string, number> = {};
    for (const file of testFiles) {
      const rel = relative(TESTS_ROOT, file).split('\\').join('/');
      const hits = matchingLines(file, TESTS_PATTERN);
      if (hits.length > 0) actual[rel] = hits.length;
    }

    const expectedFiles = Object.keys(TESTS_ALLOWLIST).sort();
    const actualFiles = Object.keys(actual).sort();
    expect(actualFiles, 'unexpected file(s) with a match, or an allowlisted file with none').toEqual(expectedFiles);

    for (const file of expectedFiles) {
      expect(actual[file], `${file}: match count`).toBe(TESTS_ALLOWLIST[file]);
    }
  });

  it('zero skip directives anywhere in packages/domain (MKR-20) — a hard zero, not a comparison', () => {
    const offenders: string[] = [];
    for (const file of [...srcFiles, ...testFiles]) {
      const text = readFileSync(file, 'utf8');
      if (SKIP_PATTERN.test(text)) offenders.push(relative(DOMAIN_ROOT, file));
    }
    expect(offenders, `files with a skip directive: ${offenders.join(', ')}`).toEqual([]);
  });
});
