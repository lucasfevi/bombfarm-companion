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
import { dirname, join, relative, sep } from 'node:path';
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

/**
 * Anchored to `describe|it|test` immediately before `.skip`/`.todo`, plus the legacy `xit`/
 * `xdescribe` call aliases — matching `tools/fixture-corpus-parity.test.mjs`'s sibling pattern
 * exactly (a cross-file check there fails if the two diverge). Anchoring, rather than an
 * unanchored `.skip`/`.todo` substring match, is what excludes `capture-regime.ts`'s runtime
 * `context.skip` call — a per-test decision made at run time, not the static suite-skip directive
 * this guard is about. (Deliberately worded without a trailing open-paren above: this file's own
 * `SKIP_PATTERN` would otherwise match its own explanatory prose.)
 */
const SKIP_PATTERN = /\b(describe|it|test)\.(skip|todo)\b|\bxit[(]|\bxdescribe[(]/;
/** The same pattern, global, so the manifest below can COUNT matches and not just detect one. */
const SKIP_PATTERN_GLOBAL = new RegExp(SKIP_PATTERN.source, 'g');

/**
 * MKR-20 was a HARD ZERO: no skipped test anywhere in this package, ever. It became an exact
 * per-file manifest for one bounded reason — the F8 stale-capture debt — and that debt is now
 * PAID. This package has no skipped test again.
 *
 * Committed fixtures captured before the 2026-08-18 patch lost 40-100% of their rosters to the
 * importer's stat-point budget refusal, so 38 assertions here described rosters that no longer
 * existed. Two in-regime captures landed (issues #137, #171, #206) and every one of those
 * assertions was re-ASKED of a different account before coming back, never re-recorded:
 * "all-attack scores BELOW the current build" REPRODUCES (1,085,794 < 1,331,738 where it was
 * 212,284 < 264,997), as do the [4, 9] gain band, the ~1.4x chest ratio and the signed gain
 * percents. "Perrin L4 FLIPPED AGAIN" was retired outright — a pinned flip standing in for a
 * subject the corpus had lost, and `save-20260825-11heroes-one-shot-spread.json` supplies a real
 * one. Two frozen refactor-parity artifacts were deleted: the refactors they proved had shipped,
 * the model had moved since, and re-freezing them would have proved nothing about what they were
 * recorded for. `docs/fixture-corpus.md` §11-§12 is the full record.
 *
 * KEEP THIS LIST EMPTY.
 */
const F8_SKIP_MANIFEST: Record<string, number> = {};

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
  // Line numbers only — still SIX matches, unchanged in kind. Re-measured after issue #132's
  // team-aura rewrite across three passes: (1) replaced `stackTeamBonusMult`/
  // `TEAM_MULT_BONUS_CAP` with `combineTeamAuraPct` and removed `teamGateMult`; (2) folded
  // Presságio's own rank into the same capped combination and removed the now-redundant
  // `combatCritChancePctOfBase` DeriveInput field; (3) the roster-is-the-field rewrite dropped
  // `teamAtkMult`/`teamSpeedMult` (now identical to `attackMult`/`speedMult`) and simplified
  // `computeCombatMults` to a fixed `ownPct: 0` at every call site, each pass adding or moving
  // doc comments above these hits.
  // +9 (line numbers only): extracting `teamDrainMultFromTeamBuffs` (so the live field
  // countdown's multiplier resolver could reuse the Fôlego de Mineiro cap/floor arithmetic
  // instead of reimplementing it) added a function and its doc comment above these hits.
  'derive.ts': [26, 89, 107, 155, 210, 221],
  // Line numbers only — still FOUR matches, unchanged in kind. Re-measured against the merged
  // tree rather than resolved to either side: this branch's House-cycle plumbing
  // (`houseCycleSecs`, then `houseCycleSecsHouseIdx`/`houseCycleSecsLevel`) and #87's farm-objective
  // rank mode each inserted lines above these hits, so BOTH pins were stale after the merge —
  // 341 from here and 325 from develop are each correct only in isolation. Issue #132's crit-
  // combination fix removed the `combatCritChancePctOfBase` pass-through line, shifting the
  // last hit down by one.
  // +3 (line numbers only): surfacing `fieldSecs` on the pipeline result added a documented
  // field to the output type and one line to the returned object, above these hits.
  // +1 (line number only): `spentDelta` now calls the shared `spentPointsOf` instead of
  // re-summing SHEET_KEYS inline, so the import block gained a line above these hits. Still FOUR
  // matches, unchanged in kind.
  'advisor-pipeline.ts': [112, 221, 250, 349],
  // +1 (line number only): the flat-crit-damage fix's `brutalStrike` LedgerNote arm
  // (review item 5, PR #90) added one line above this hit.
  'stat-breakdown/types.ts': [106],
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

  it('skip directives in packages/domain are exactly the declared F8 manifest (MKR-20)', () => {
    const actual: Record<string, number> = {};
    for (const file of [...srcFiles, ...testFiles]) {
      const rel = relative(DOMAIN_ROOT, file).split(sep).join('/');
      const hits = readFileSync(file, 'utf8').match(SKIP_PATTERN_GLOBAL);
      if (hits) actual[rel] = hits.length;
    }

    const expectedFiles = Object.keys(F8_SKIP_MANIFEST).sort();
    const actualFiles = Object.keys(actual).sort();
    expect(
      actualFiles,
      'a skip appeared outside the F8 manifest, or a manifested file no longer has one',
    ).toEqual(expectedFiles);

    for (const file of expectedFiles) {
      expect(actual[file], `${file}: skip count`).toBe(F8_SKIP_MANIFEST[file]);
    }
  });
});
