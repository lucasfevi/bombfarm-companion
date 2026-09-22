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
 * manually in a scratch state (perturb one byte, restore a deleted fixture, add one skip) — see
 * `docs/fixture-corpus.md` / `docs/validation.md` for the observed failure messages.
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

  const SKIPS_NOT_F8 = {};

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
