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
 * MP5 F1 (T9) — cross-package, cross-repo hygiene. `tools/` is the established home for
 * cross-package source scans (`design-system-gate.test.mjs`, `ci-desktop-paths.test.mjs`,
 * `web-domain-source-resolution.test.mjs`). Every red state below has been demonstrated
 * manually in a scratch state (perturb one byte, restore a deleted fixture, add one skip, add
 * one keystone reference) — see `docs/fixture-corpus.md` / `validation.md` for the observed
 * failure messages.
 */
describe('cross-package fixture corpus parity (MP5 F1)', () => {
  it('byte identity across trees (MFR-06): every filename in both sheet-math/ directories hashes equal', () => {
    const domainNames = new Set(readdirSync(DOMAIN_SHEET_MATH));
    const webNames = new Set(readdirSync(WEB_SHEET_MATH));
    const shared = [...domainNames].filter((n) => webNames.has(n));
    expect(shared.length, 'shared-name set between the two sheet-math/ directories').toBeGreaterThan(0);

    const mismatches = [];
    for (const name of shared) {
      const domainHash = sha256(join(DOMAIN_SHEET_MATH, name));
      const webHash = sha256(join(WEB_SHEET_MATH, name));
      if (domainHash !== webHash) mismatches.push(name);
    }
    expect(mismatches, `divergent files: ${mismatches.join(', ')}`).toEqual([]);
  });

  it('one capture, N checked copies (AD-070): export-capture.json and payload-20260812-8heroes.json are checked byte-identical invariants, not drift', () => {
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

  it('no legacy/archive/__old__ path segment exists anywhere in the tracked tree (MFR-01 AC-6)', () => {
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

  it('zero describe/it/test.skip|todo directives remain under packages/domain/tests/, apps/web/src/tests/ or apps/desktop/** (MFR-18, TD-8 — a hard zero, not a baseline comparison)', () => {
    const SKIP_PATTERN = '\\b(describe|it|test)\\.(skip|todo)\\b';
    const scanRoots = ['packages/domain/tests', 'apps/web/src/tests', 'apps/desktop'];
    const offenders = [];
    for (const scanRoot of scanRoots) {
      let files = [];
      try {
        const out = execFileSync('git', ['grep', '-lE', SKIP_PATTERN, '--', scanRoot], {
          cwd: root,
          encoding: 'utf8',
        });
        files = out.split('\n').filter(Boolean);
      } catch (err) {
        // git grep exits 1 when it finds nothing in that root — that is the passing case.
        if (err.status !== 1) throw err;
      }
      offenders.push(...files);
    }
    expect(offenders, `files carrying a skip/todo directive: ${offenders.join(', ')}`).toEqual([]);
  });

  // The full identifier list AD-069/MFR-15 names. Matches are counted the same way tasks.md's
  // own baseline was captured: `git grep -ncE '<pattern>' | sum(field 2)`. Unchanged since F1 —
  // MP5 F2 (T11, AD-074) re-measures the constant and adds the per-file packages/domain map
  // below; it does not touch the pattern or the counting method.
  const PATTERN =
    'abisso|abissoBase|abisso_base|glassCannon|treeGlassCannon|tempoDobrado|treeTempoDobrado|critDmgMult|crit_dmg_mult|keystones';

  function grepCounts(pathspec) {
    const args = ['grep', '-ncE', PATTERN];
    if (pathspec) args.push('--', pathspec);
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

  it('keystone-identifier handoff count: total matches across the tracked tree equals a committed constant, in either direction (MFR-15)', () => {
    const total = grepCounts(null).reduce((sum, row) => sum + row.count, 0);

    // COMMITTED CONSTANT — re-measured at every F1/F2 file addition (docs/fixture-corpus.md
    // carries the discrepancy history). MP5 F2 (T11): tightened for packages/domain (see the
    // per-file map below); apps/web/src/**, apps/desktop/**, packages/ui/** and apps/web/e2e/**
    // still ship hundreds of legitimate, currently-correct references to functionality F2 does
    // not touch (F2 is scoped to packages/domain/src and packages/domain/tests only) — a full
    // five-surface zero-match check would be permanently red until F3 lands. This total-count
    // assertion is the only guard over that remaining surface; F3 inherits it as a named
    // handoff and can replace it with the literal five-surface check once apps/web reaches zero.
    const KEYSTONE_IDENTIFIER_HANDOFF_COUNT = 526;

    expect(total, `measured ${total}, committed constant is ${KEYSTONE_IDENTIFIER_HANDOFF_COUNT}`).toBe(
      KEYSTONE_IDENTIFIER_HANDOFF_COUNT,
    );
  });

  // MP5 F2 (T11, AD-074): tightens the half of MFR-15's five-surface check F2 can reach.
  // packages/domain is the ONLY surface where every reference is provably accounted for after
  // this feature (source-surface.test.ts pins the src/tests split from inside the package) — so
  // this guard mirrors that map from outside, at the whole-tree level a total count cannot
  // reach: a count-preserving move (delete a match from one packages/domain file, add it to
  // another, or to docs/) is invisible to the total-count assertion above but fails HERE by
  // naming the file. apps/web/apps/desktop/packages/ui stay on the coarse total (handed to F3).
  const DOMAIN_MATCH_MAP = {
    'packages/domain/CHANGELOG.md': 3,
    'packages/domain/src/advisor-pipeline.ts': 4,
    'packages/domain/src/derive.ts': 6,
    'packages/domain/src/stat-breakdown/types.ts': 1,
    'packages/domain/src/team-plan/score.ts': 1,
    'packages/domain/tests/advisor-pipeline.test.ts': 1,
    'packages/domain/tests/derive.test.ts': 14,
    'packages/domain/tests/fidelity-compare.test.ts': 1,
    'packages/domain/tests/fixture-corpus.test.ts': 2,
    'packages/domain/tests/fixtures/i18n-strings-main.json': 9,
    'packages/domain/tests/fixtures/invariance/baseline.json': 13,
    'packages/domain/tests/fixtures/sheet-math/README.md': 1,
    'packages/domain/tests/fixtures/storage-roundtrip-20260729.json': 1,
    'packages/domain/tests/helpers/invariance-record.ts': 4,
    'packages/domain/tests/points-reopt.test.ts': 3,
    'packages/domain/tests/source-surface.test.ts': 6,
    'packages/domain/tests/stat-breakdown.test.ts': 2,
    'packages/domain/tests/team-plan-ability-extras.test.ts': 1,
    'packages/domain/tests/team-plan-auras.test.ts': 1,
    'packages/domain/tests/team-plan-evaluate.test.ts': 4,
    'packages/domain/tests/team-plan-pool.test.ts': 1,
    'packages/domain/tests/team-plan-score.test.ts': 2,
  };

  it('keystone-identifier handoff count: packages/domain matches fall on an exact, pinned per-file map (MFR-15, AD-074)', () => {
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
});
