/**
 * `fixture-corpus.test.ts` enforces provenance completeness for `fixtures/sheet-math/` (every
 * committed capture has a README row naming what it may/may not prove, every row names a file
 * that exists, and the row's recorded digest matches the committed bytes). `fixtures/farm-rate/`
 * carries the identical README shape (see its own header: "Same scrub rules apply either way")
 * but nothing enforced it — a capture could be added there with no row, or a row could go stale
 * against a renamed/re-scrubbed file, and neither would fail anything. This is that guard, for
 * the one other directory in the package that holds real external captures under its own
 * provenance manifest.
 */
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assertProvenanceComplete, assertRecordedDigests } from './helpers/readme-provenance';

const here = dirname(fileURLToPath(import.meta.url));
const FARM_RATE_DIR = join(here, 'fixtures', 'farm-rate');
const README_PATH = join(FARM_RATE_DIR, 'README.md');

describe('farm-rate fixture corpus guard', () => {
  const farmRateJsonFiles = readdirSync(FARM_RATE_DIR).filter((f) => f.endsWith('.json'));

  it('non-vacuity: fixtures/farm-rate/ has at least 1 committed capture', () => {
    expect(farmRateJsonFiles.length, `walked ${FARM_RATE_DIR}`).toBeGreaterThanOrEqual(1);
  });

  it('provenance completeness, both directions: every farm-rate/ file has a README row, every row names a file that exists', () => {
    assertProvenanceComplete(README_PATH, farmRateJsonFiles, 'farm-rate');
  });

  it("committed-file digest: each farm-rate/ file's SHA-256 equals the value its README row records", () => {
    assertRecordedDigests(FARM_RATE_DIR, README_PATH, farmRateJsonFiles);
  });
});
