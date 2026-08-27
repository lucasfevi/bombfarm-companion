/**
 * The two per-directory guards (`fixture-corpus.test.ts` for `sheet-math/`,
 * `farm-rate-fixture-corpus.test.ts` for `farm-rate/`) each prove their own directory's captures
 * are fully inventoried in its README. Neither says anything about a THIRD directory: nothing
 * stopped a capture from landing somewhere else in `fixtures/**` with no README governing it at
 * all, which is a capture that is not merely under-documented but invisible to every inventory
 * guard that exists.
 *
 * This is the bound: every committed file whose name carries the corpus's own capture-naming
 * convention (`save-YYYYMMDD-...` / `payload-YYYYMMDD-...` — the same pattern
 * `helpers/capture-regime.ts` parses) must live in a directory this file declares GOVERNED, i.e.
 * one with a per-directory guard proving its README is complete. A capture landing in a new
 * directory fails here by construction; the fix is to add that directory to
 * {@link GOVERNED_CAPTURE_DIRS} and give it the same README + completeness guard the two
 * existing directories have — never to widen this file's pattern to stop noticing it.
 */
import { readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(here, 'fixtures');

/**
 * Directories under `fixtures/` that carry a README provenance manifest AND a guard proving it
 * complete (README row per file, digest matching, no dangling row) — measured today as exactly
 * `fixture-corpus.test.ts` and `farm-rate-fixture-corpus.test.ts`. `fidelity-gate/` is deliberately
 * NOT here: its one capture-shaped file (`export-capture.json`) carries no `save-`/`payload-`
 * date prefix, so this guard's pattern does not reach it — its provenance is `pair.json` (a
 * machine-readable manifest naming `capturedAt`/`gameBuild`) plus the cross-directory pinned-
 * duplicate check in `tools/fixture-corpus-parity.test.mjs` (AD-070), not a directory of this
 * shape.
 */
const GOVERNED_CAPTURE_DIRS = ['sheet-math', 'farm-rate'];

const CAPTURE_NAME_PATTERN = /^(?:save|payload)-\d{8}-/;

function listJsonFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      listJsonFiles(full, acc);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      acc.push(full);
    }
  }
  return acc;
}

describe('fixture corpus bounds: every capture-named file lives in a governed, inventoried directory', () => {
  const allJsonFiles = listJsonFiles(FIXTURES_DIR).map((f) => relative(FIXTURES_DIR, f).replace(/\\/g, '/'));

  it('non-vacuity: the walk finds committed fixture JSON, and at least one is capture-named', () => {
    expect(allJsonFiles.length, `walked ${FIXTURES_DIR}`).toBeGreaterThan(0);
    const captureNamed = allJsonFiles.filter((f) => CAPTURE_NAME_PATTERN.test(f.split('/').pop()!));
    expect(captureNamed.length, 'capture-named (save-/payload-YYYYMMDD-) files found').toBeGreaterThan(0);
  });

  it('every capture-named file lives directly inside a governed directory', () => {
    const offenders: string[] = [];
    for (const file of allJsonFiles) {
      const parts = file.split('/');
      const basename = parts[parts.length - 1];
      if (!CAPTURE_NAME_PATTERN.test(basename)) continue;
      const dir = parts.length >= 2 ? parts[parts.length - 2] : null;
      if (dir === null || !GOVERNED_CAPTURE_DIRS.includes(dir)) offenders.push(file);
    }
    expect(
      offenders,
      `capture-named file(s) outside a governed, inventoried directory (${GOVERNED_CAPTURE_DIRS.join(', ')}): ` +
        `${offenders.join(', ')} — add its directory to GOVERNED_CAPTURE_DIRS and give it the same ` +
        'README + completeness guard sheet-math/ and farm-rate/ already have',
    ).toEqual([]);
  });
});
