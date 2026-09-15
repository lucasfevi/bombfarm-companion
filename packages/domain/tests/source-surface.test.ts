/**
 * The skip-directive guard: no skipped or todo suite anywhere in this package unless it is named
 * in the manifest below — and the manifest is empty.
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
 * This guard was a HARD ZERO: no skipped test anywhere in this package, ever. It became an exact
 * per-file manifest for one bounded reason — the stale-capture debt — and that debt is now PAID.
 * This package has no skipped test again.
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

describe('source-surface — the skip-directive guard', () => {
  const srcFiles = listFiles(SRC_ROOT);
  const testFiles = listFiles(TESTS_ROOT);

  it('non-vacuity: the scan roots are non-empty and meet a committed floor', () => {
    expect(srcFiles.length, `scanned ${SRC_ROOT}`).toBeGreaterThanOrEqual(50);
    expect(testFiles.length, `scanned ${TESTS_ROOT}`).toBeGreaterThanOrEqual(50);
  });

  it('skip directives in packages/domain are exactly the declared F8 manifest', () => {
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
