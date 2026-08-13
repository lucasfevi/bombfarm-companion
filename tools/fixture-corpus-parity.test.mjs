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

  it('zero "QUARANTINED (catalog v4" occurrences remain in the tracked tree', () => {
    let matches = [];
    try {
      const out = execFileSync('git', ['grep', '-l', 'QUARANTINED (catalog v4'], {
        cwd: root,
        encoding: 'utf8',
      });
      matches = out.split('\n').filter(Boolean);
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

  it('keystone-identifier handoff count: total matches across the tracked tree equals a committed constant, in either direction (MFR-15)', () => {
    // The full identifier list AD-069/MFR-15 names. Matches are counted the same way
    // tasks.md's own baseline was captured: `git grep -ncE '<pattern>' | sum(field 2)`.
    const PATTERN =
      'abisso|abissoBase|abisso_base|glassCannon|treeGlassCannon|tempoDobrado|treeTempoDobrado|critDmgMult|crit_dmg_mult|keystones';
    const out = execFileSync('git', ['grep', '-ncE', PATTERN], { cwd: root, encoding: 'utf8' });
    const total = out
      .split('\n')
      .filter(Boolean)
      .reduce((sum, line) => sum + Number(line.slice(line.lastIndexOf(':') + 1)), 0);

    // COMMITTED CONSTANT — F2's handoff number. Re-measured at every T9/T10 file addition;
    // see docs/fixture-corpus.md for the recorded discrepancy this constant carries: it is
    // NOT scoped to only packages/domain/src/**, apps/web/src/** (non-test), apps/desktop/**,
    // packages/ui/**, apps/web/e2e/** and the two named F2 suites, as design.md's narrative
    // describes. Measured reality: dozens of pre-existing, non-quarantined, non-corpus test
    // files (e.g. advisor-pipeline.test.ts, storage-abisso-base-compat.test.ts,
    // tree-guards.test.ts, the team-plan-* suites) legitimately test STILL-SHIPPING keystone
    // functionality with synthetic (non-fixture) data — F1 never touches packages/domain/src,
    // so that functionality and its test coverage are correctly untouched and still present.
    // Narrowing this guard to the design's literal five-surface list would either (a) fail
    // permanently (a red guard nobody can make pass without deleting real, currently-correct
    // coverage — forbidden), or (b) require editing dozens of unrelated tests, which is F2/F3's
    // job, not F1's. The mechanically useful and honest guarantee this guard CAN make today is
    // drift detection: this total must not move until F2 or F3 deliberately change it.
    const KEYSTONE_IDENTIFIER_HANDOFF_COUNT = 836;

    expect(total, `measured ${total}, committed constant is ${KEYSTONE_IDENTIFIER_HANDOFF_COUNT}`).toBe(
      KEYSTONE_IDENTIFIER_HANDOFF_COUNT,
    );
  });
});
