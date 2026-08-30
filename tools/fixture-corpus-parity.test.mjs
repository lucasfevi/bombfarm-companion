import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const DOMAIN_SHEET_MATH = join(root, 'packages/domain/tests/fixtures/sheet-math');
const WEB_SHEET_MATH = join(root, 'apps/web/src/tests/fixtures/sheet-math');
const FIDELITY_DIR = join(root, 'packages/domain/tests/fixtures/fidelity-gate');
const API_DIR = join(root, 'packages/domain/tests/fixtures/api');

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function trackedFiles() {
  return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

/**
 * (T9) — cross-package, cross-repo hygiene. `tools/` is the established home for
 * cross-package source scans (`design-system-gate.test.mjs`, `ci-desktop-paths.test.mjs`,
 * `web-domain-source-resolution.test.mjs`). Every red state below has been demonstrated
 * manually in a scratch state (perturb one byte, restore a deleted fixture, add one skip, add
 * one keystone reference) — see `docs/fixture-corpus.md` / `validation.md` for the observed
 * failure messages.
 */
describe('cross-package fixture corpus parity', () => {
  // Domain became the corpus's sole committed copy when the six sheet-math captures were
  // deduped off apps/web (5a17fc94) — this replaces the old byte-identity-across-trees check,
  // whose premise (two committed copies) that same commit deliberately eliminated. What is left
  // to guard is the opposite direction: nothing re-adds a fixture JSON at the web path, a gap the
  // whole-tree duplicate-content sweep at the bottom of this file cannot close on its own, since
  // it only catches a re-added file that happens to duplicate existing content byte-for-byte, not
  // a genuinely new one.
  it('web sheet-math holds no fixture JSON: domain is the sole committed copy', () => {
    let entries;
    try {
      entries = readdirSync(WEB_SHEET_MATH);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      entries = [];
    }
    const jsonFiles = entries.filter((name) => name.endsWith('.json'));
    expect(
      jsonFiles,
      `fixture JSON committed under ${WEB_SHEET_MATH} — domain is the sole copy: ${jsonFiles.join(', ')}`,
    ).toEqual([]);
  });

  it('one capture, N checked copies: export-capture.json and payload-20260812-8heroes.json are checked byte-identical invariants, not drift', () => {
    const exportCaptureHash = sha256(join(FIDELITY_DIR, 'export-capture.json'));
    const domainExportHash = sha256(join(DOMAIN_SHEET_MATH, 'save-20260813-5heroes.json'));
    expect(exportCaptureHash, 'fidelity-gate/export-capture.json vs sheet-math/save-20260813-5heroes.json').toBe(
      domainExportHash,
    );

    const domainPayloadHash = sha256(join(DOMAIN_SHEET_MATH, 'payload-20260812-8heroes.json'));
    const apiPayloadHash = sha256(join(API_DIR, 'assembled-payload-before.json'));
    expect(
      domainPayloadHash,
      'sheet-math/payload-20260812-8heroes.json vs fixtures/api/assembled-payload-before.json',
    ).toBe(apiPayloadHash);
  });

  it('no legacy/archive/__old__ path segment exists anywhere in the tracked tree', () => {
    const files = trackedFiles();
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter((f) => /(^|\/)(legacy|archive|__old__)(\/|$)/.test(f));
    expect(offenders, `paths under a legacy/archive/__old__ segment: ${offenders.join(', ')}`).toEqual([]);
  });

  // The header string is assembled from parts (never written contiguously) so this guard's own
  // source does not match its own search — the same reason `fixtures-scrubbed.test.ts` exempts
  // `pair.json`'s attestation list rather than obscuring the field names it checks for.
  const QUARANTINE_HEADER = ['QUARANTINED', ' (catalog v4'].join('');

  it('zero quarantine-header occurrences remain in the tracked tree', () => {
    let matches = [];
    try {
      const out = execFileSync('git', ['grep', '-l', QUARANTINE_HEADER], {
        cwd: root,
        encoding: 'utf8',
      });
      matches = out.split('\n').filter(Boolean).filter((f) => f !== 'tools/fixture-corpus-parity.test.mjs');
    } catch (err) {
      // git grep exits 1 when it finds nothing — that is the passing case here.
      if (err.status !== 1) throw err;
    }
    expect(matches, `files still carrying the quarantine header: ${matches.join(', ')}`).toEqual([]);
  });

  /**
   * This guard was a HARD ZERO: no skipped test under these roots, ever. It became an exact
   * per-file manifest for one bounded reason — the F8 stale-capture debt — and that debt is now
   * PAID: the list below is empty, and every skip in the tree is a deliberate one declared in
   * `SKIPS_NOT_F8`.
   *
   * WHAT THE DEBT WAS. Ten committed fixtures across six suites were captured before the
   * 2026-08-18 patch, and the importer now refuses a hero whose sheet inverts above its
   * stat-point budget — so those captures lost 40-100% of their rosters, and 58 assertions about
   * those rosters described something that no longer existed.
   *
   * HOW IT WAS PAID (issues #137, #171, #206). Two in-regime captures landed —
   * `save-20260819-11882-7heroes.json` (a second account, 7 of 7 accepted, 40 items worn, a
   * BINDING House) and `save-20260825-11heroes-one-shot-spread.json` (both sides of the one-shot
   * contrast on one roster) — plus a re-derivation of the two SYNTHETIC fixtures that had drifted
   * the same way (`apps/web/e2e/fixtures/sample-save.json`, which was blocking 2 of its 3 heroes,
   * and `import-save.test.ts`'s own `baseSave()`).
   *
   * Every finding was re-ASKED of a different account before its test came back, never
   * re-recorded: the inverted-intuition result, the [4, 9] gain band, the ~1.4x chest ratio, the
   * gold/chest crossover and the signed gain percents all REPRODUCE. Three did not, and are
   * recorded as losses in the files that carried them with the measurement that killed each. Two
   * frozen refactor-parity artifacts were deleted outright — the refactors they proved had
   * shipped, so re-freezing them would have proved nothing. `docs/fixture-corpus.md` §11-§12 is
   * the full record.
   *
   * KEEP THIS LIST EMPTY. A skip that is stale-capture debt goes here, so the worklist is visible
   * again; a skip that is not goes in `SKIPS_NOT_F8` below, with its own reason.
   */
  const F8_SKIP_MANIFEST = {};

  const SKIPS_NOT_F8 = {
    'apps/web/e2e/visual.spec.ts': 3,
  };

  it('skip/todo directives across the test roots are exactly the declared manifests', () => {
    const SKIP_PATTERN = '\\b(describe|it|test)\\.(skip|todo)\\b|\\bxit[(]|\\bxdescribe[(]';
    const SKIP_PATTERN_GLOBAL = new RegExp(SKIP_PATTERN, 'g');
    const scanRoots = ['packages/domain/tests', 'apps/web/src/tests', 'apps/web/e2e', 'apps/desktop'];
    const actual = {};
    for (const scanRoot of scanRoots) {
      let files = [];
      try {
        // `-l` lists matching files, not lines: `-c` counts matching LINES, which undercounts a
        // file carrying two skip directives on one physical line. Occurrences are counted below
        // instead, the same way the sibling guard (packages/domain/tests/source-surface.test.ts)
        // does it, by reading the whole file and matching the pattern globally.
        const out = execFileSync('git', ['grep', '-lE', SKIP_PATTERN, '--', scanRoot], {
          cwd: root,
          encoding: 'utf8',
        });
        files = out.split('\n').filter(Boolean);
      } catch (err) {
        // git grep exits 1 when it finds nothing in that root — that is a root with no skips.
        if (err.status !== 1) throw err;
      }
      for (const file of files) {
        const hits = readFileSync(join(root, file), 'utf8').match(SKIP_PATTERN_GLOBAL);
        actual[file] = hits ? hits.length : 0;
      }
    }

    const declared = { ...F8_SKIP_MANIFEST, ...SKIPS_NOT_F8 };
    const expectedFiles = Object.keys(declared).sort();
    const actualFiles = Object.keys(actual).sort();
    expect(
      actualFiles,
      'a skip appeared outside the manifests, or a manifested file no longer has one',
    ).toEqual(expectedFiles);

    for (const file of expectedFiles) {
      expect(actual[file], `${file}: skip count`).toBe(declared[file]);
    }
  });

  // The full identifier list this guard names. Matches are counted the same way tasks.md's
  // own baseline was captured: `git grep -ncE '<pattern>' | sum(field 2)`. Unchanged since F1 —
  // T11 re-measures the constant and adds the per-file packages/domain map
  // below; it does not touch the pattern or the counting method.
  const PATTERN =
    'abisso|abissoBase|abisso_base|glassCannon|treeGlassCannon|tempoDobrado|treeTempoDobrado|critDmgMult|crit_dmg_mult|keystones';

  /**
   * Release-note prose is outside this scan, for the same reason as in the sibling guard (see
   * its `EXCLUDE_RELEASE_PROSE`): `changeset version` relocates the identical text from
   * `.changeset/<name>.md` into each bumped package's `CHANGELOG.md`, so any per-file pin over
   * it holds on `develop` and breaks on the release branch. Here that hit twice over — the four
   * mapped `.changeset/*.md` entries below vanish when the batch is consumed, and the text
   * reappears inside three typed surfaces, one of which (`packages/ui`) is asserted a hard zero.
   * Excluding both keeps the five-surface decomposition measuring live source, which is what
   * the five-surface check set out to prove; its own surface 5 already reads "release-note history".
   */
  const EXCLUDE_RELEASE_PROSE = [':(exclude)**/CHANGELOG.md', ':(exclude).changeset/*.md'];

  function grepCounts(pathspec) {
    const args = ['grep', '-ncE', PATTERN];
    args.push('--', ...(pathspec ? [pathspec] : []), ...EXCLUDE_RELEASE_PROSE);
    let out;
    try {
      out = execFileSync('git', args, { cwd: root, encoding: 'utf8' });
    } catch (err) {
      // git grep exits 1 when it finds nothing in that pathspec.
      if (err.status === 1) return [];
      throw err;
    }
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const idx = line.lastIndexOf(':');
        return { file: line.slice(0, idx), count: Number(line.slice(idx + 1)) };
      });
  }

  // (T10) — this guard reaches its final form here. F1 shipped a whole-tree
  // total-count guard (850, then re-measured to 526); its Verifier proved a count-preserving
  // cross-surface move survives a bare total (Probe A — a match deleted from one file and added
  // to another leaves the sum unchanged). F2 tightened `packages/domain` to the per-file map
  // below and explicitly handed the rest to F3: "when F3 lands, apps/web/apps/desktop/
  // packages/ui reach zero and the total-count clause can be replaced by the literal five-surface
  // check for the whole tree." F3 is the feature that makes it reachable, so F3 completes it: the
  // total-count assertion is REPLACED — not supplemented — by an explicit five-surface
  // decomposition. Four of the five surfaces (apps/web, apps/desktop, packages/ui, tools/+docs/+
  // CHANGELOGs) are scanned in full per-file/per-line detail by the sibling guard
  // `tools/keystone-surface-absence.test.mjs` (kept separate — two distinct concerns,
  // "has the corpus drifted?" here vs. "is the mechanic gone?" there — in one file would make
  // both harder to read and harder to delete when MP5 closes). This test re-derives the SAME
  // five numbers independently (not by importing the sibling file) and asserts the whole tree
  // decomposes into exactly those five surfaces with nothing left over — the two guards
  // corroborate one another rather than sharing code.
  // Surface 5 ("tools + docs + CHANGELOGs" in the five-surface check's table) is every match outside the four
  // typed surfaces above — root `docs/`, `.changeset/*.md`, `packages/contracts` (F4's
  // `missingKeys: ['totals.crit_dmg_mult']`, allowlist #6) and this file's own pattern
  // self-reference. None of these carry a live, editable, or rendered keystone surface; each is
  // provenance, release-note history, or a guard naming what it forbids. Pinned as a committed
  // per-file map (not a bare count) so a move within this residual still fails by name.
  const RESIDUAL_MATCH_MAP = {
    // The four `.changeset/*.md` entries that used to head this map are gone: pending changesets
    // are release-note prose, excluded above, and each one is deleted by `changeset version`
    // anyway — so a map naming them fails on the release branch by definition.
    'docs/base-ui-first.md': 1,
    'docs/content-fit-ui.md': 1,
    'docs/fidelity-gate.md': 1,
    'docs/fixture-corpus.md': 8,
    'packages/contracts/src/account-change-key.test.ts': 1,
    'tools/fixture-corpus-parity.test.mjs': 2,
    'tools/keystone-surface-absence.test.mjs': 10,
    // T7 — the acceptance-gate absence-proving guard must name the tokens it
    // scans source for. New here at T12's re-pin.
    'tools/save-acceptance-guards.test.mjs': 3,
  };

  it('keystone-identifier handoff: the whole tree decomposes into exactly five surfaces, packages/ui a hard zero', () => {
    const total = grepCounts(null).reduce((sum, row) => sum + row.count, 0);
    const domainTotal = grepCounts('packages/domain').reduce((sum, row) => sum + row.count, 0);
    const webTotal = grepCounts('apps/web').reduce((sum, row) => sum + row.count, 0);
    const desktopTotal = grepCounts('apps/desktop').reduce((sum, row) => sum + row.count, 0);
    const uiTotal = grepCounts('packages/ui').reduce((sum, row) => sum + row.count, 0);

    expect(uiTotal, 'packages/ui: hard zero, no allowlist').toBe(0);

    // Surface 5, pinned per-file: apps/web/apps/desktop/packages/ui/packages/domain are scanned
    // by their own precise checks (here and in tools/keystone-surface-absence.test.mjs); every
    // remaining match must fall exactly on RESIDUAL_MATCH_MAP.
    const residualRows = grepCounts(null).filter(
      (row) =>
        !row.file.startsWith('packages/domain/') &&
        !row.file.startsWith('apps/web/') &&
        !row.file.startsWith('apps/desktop/') &&
        !row.file.startsWith('packages/ui/'),
    );
    const actualResidual = Object.fromEntries(residualRows.map((r) => [r.file, r.count]));
    const expectedResidualFiles = Object.keys(RESIDUAL_MATCH_MAP).sort();
    const actualResidualFiles = Object.keys(actualResidual).sort();
    expect(
      actualResidualFiles,
      'unexpected file with a match outside the four typed surfaces, or a mapped residual file with none',
    ).toEqual(expectedResidualFiles);
    for (const file of expectedResidualFiles) {
      expect(actualResidual[file], `${file}: match count`).toBe(RESIDUAL_MATCH_MAP[file]);
    }
    const residualTotal = residualRows.reduce((sum, row) => sum + row.count, 0);

    expect(
      domainTotal + webTotal + desktopTotal + uiTotal + residualTotal,
      `the five surfaces (domain ${domainTotal} + web ${webTotal} + desktop ${desktopTotal} + ` +
        `ui ${uiTotal} + residual ${residualTotal}) must sum to the measured whole-tree total ${total}`,
    ).toBe(total);
  });

  // T11, re-measured by T10: packages/domain is the surface
  // where every reference is provably accounted for from inside the package
  // (source-surface.test.ts pins the src/tests split) — this guard mirrors that map from
  // outside, at the whole-tree level a total count cannot reach: a count-preserving move (delete
  // a match from one packages/domain file, add it to another, or to docs/) fails HERE by naming
  // the file. Re-measured at 3d7a290 (F2's follow-up commit dropped the five team-plan-* test
  // files' matches, moving this map from 22 files to 17).
  const DOMAIN_MATCH_MAP = {
    'packages/domain/src/advisor-pipeline.ts': 4,
    'packages/domain/src/derive.ts': 6,
    'packages/domain/src/stat-breakdown/types.ts': 1,
    'packages/domain/src/team-plan/score.ts': 1,
    'packages/domain/tests/advisor-pipeline.test.ts': 1,
    // Re-measured for the domain test-typecheck widening: two of this pattern's matches sat on
    // `TreeSheetTotals`-typed object literals as excess-property keys that type never had (the
    // surviving field lives on `DeriveInput`/`ComputeCombatMultsInput` elsewhere in this same
    // file, untouched) — `tsc -p tsconfig.typecheck.json` caught them, dropping this file from
    // 14 to 12.
    'packages/domain/tests/derive.test.ts': 12,
    'packages/domain/tests/fidelity-compare.test.ts': 1,
    'packages/domain/tests/fixture-corpus.test.ts': 2,
    'packages/domain/tests/fixtures/i18n-strings-main.json': 9,
    // T7: the committed pre-patch rejection fixture — deliberately carries the
    // retired mechanic's tokens, that is its whole purpose. Added here at T12 alongside the
    // identifier guard's own re-pin; every other entry in this map is unmoved (raw git grep
    // output in the commit body).
    'packages/domain/tests/fixtures/rejection/pre-update-save.json': 3,
    'packages/domain/tests/fixtures/sheet-math/README.md': 1,
    'packages/domain/tests/fixtures/storage-roundtrip-20260729.json': 1,
    'packages/domain/tests/helpers/invariance-record.ts': 4,
    'packages/domain/tests/points-reopt.test.ts': 2,
    'packages/domain/tests/source-surface.test.ts': 6,
    'packages/domain/tests/stat-breakdown.test.ts': 2,
  };

  it('keystone-identifier handoff count: packages/domain matches fall on an exact, pinned per-file map', () => {
    const rows = grepCounts('packages/domain');
    expect(rows.length, 'non-vacuity: packages/domain must contain at least one match today').toBeGreaterThan(0);

    const actual = Object.fromEntries(rows.map((r) => [r.file, r.count]));
    const expectedFiles = Object.keys(DOMAIN_MATCH_MAP).sort();
    const actualFiles = Object.keys(actual).sort();
    expect(actualFiles, 'unexpected packages/domain file with a match, or a mapped file with none').toEqual(
      expectedFiles,
    );
    for (const file of expectedFiles) {
      expect(actual[file], `${file}: match count`).toBe(DOMAIN_MATCH_MAP[file]);
    }
  });

  // The general safety net behind the two named invariants above: no OTHER capture may
  // be committed at more than one path. Content-hash based, not filename based — a rename or a
  // re-serialization of the same account state would otherwise slip past a name-only check.
  // Scoped to the tree's fixture directories rather than every tracked file, so an incidental
  // match (an empty `{}` config, a shared license header) can't produce a false positive.
  const FIXTURE_ROOTS = [
    'apps/desktop/src/main/live-source/fixtures',
    'apps/desktop/tests/fixtures',
    'apps/web/e2e/fixtures',
    'apps/web/src/tests/fixtures',
    'packages/domain/tests/fixtures',
    'packages/game-api/src/__fixtures__',
    'packages/game-data/fixtures',
    'tools/release/__fixtures__',
    'tools/wiki-drift/__fixtures__',
  ];

  // The two pairs the tests above already name and require are documented, intentional
  // duplication, not drift — every other cross-path match is unexpected.
  const KNOWN_DUPLICATE_PAIRS = [
    [
      'packages/domain/tests/fixtures/fidelity-gate/export-capture.json',
      'packages/domain/tests/fixtures/sheet-math/save-20260813-5heroes.json',
    ],
    [
      'packages/domain/tests/fixtures/api/assembled-payload-before.json',
      'packages/domain/tests/fixtures/sheet-math/payload-20260812-8heroes.json',
    ],
  ];
  const KNOWN_DUPLICATE_KEYS = new Set(KNOWN_DUPLICATE_PAIRS.map((pair) => [...pair].sort().join('|')));

  it('no fixture JSON is committed at more than one path beyond the two named invariants above', () => {
    const files = trackedFiles().filter(
      (f) => f.endsWith('.json') && FIXTURE_ROOTS.some((fixtureRoot) => f === fixtureRoot || f.startsWith(`${fixtureRoot}/`)),
    );
    expect(files.length, 'walked the fixture roots for .json files').toBeGreaterThan(0);

    const byHash = new Map();
    for (const file of files) {
      const hash = sha256(join(root, file));
      const group = byHash.get(hash) ?? [];
      group.push(file);
      byHash.set(hash, group);
    }

    const unexpectedDuplicates = [];
    for (const group of byHash.values()) {
      if (group.length < 2) continue;
      if (KNOWN_DUPLICATE_KEYS.has([...group].sort().join('|'))) continue;
      unexpectedDuplicates.push(group);
    }
    expect(
      unexpectedDuplicates,
      `fixture content committed at more than one path: ${unexpectedDuplicates.map((g) => g.join(' == ')).join('; ')}`,
    ).toEqual([]);
  });

  // The domain package's own skip-directive pattern (packages/domain/tests/source-surface.test.ts)
  // is a hand-copied JS RegExp equivalent of this file's ERE string, with nothing else keeping the
  // two in sync — read both files' source and compare the literal pattern text.
  it('the skip-directive pattern here matches packages/domain/tests/source-surface.test.ts exactly', () => {
    const selfSource = readFileSync(join(root, 'tools/fixture-corpus-parity.test.mjs'), 'utf8');
    const selfMatch = /const SKIP_PATTERN = '([^']+)'/.exec(selfSource);
    expect(selfMatch, "could not find this file's own SKIP_PATTERN literal").not.toBeNull();

    const siblingPath = join(root, 'packages/domain/tests/source-surface.test.ts');
    const siblingSource = readFileSync(siblingPath, 'utf8');
    const siblingMatch = /const SKIP_PATTERN = \/(.+)\/;/.exec(siblingSource);
    expect(siblingMatch, 'could not find SKIP_PATTERN in source-surface.test.ts').not.toBeNull();

    expect(
      selfMatch[1].replace(/\\\\/g, '\\'),
      'the skip-directive pattern here and in source-surface.test.ts have diverged',
    ).toBe(siblingMatch[1]);
  });
});
