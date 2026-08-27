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
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const FARM_RATE_DIR = join(here, 'fixtures', 'farm-rate');
const README_PATH = join(FARM_RATE_DIR, 'README.md');

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('farm-rate fixture corpus guard', () => {
  const farmRateJsonFiles = readdirSync(FARM_RATE_DIR).filter((f) => f.endsWith('.json'));

  it('non-vacuity: fixtures/farm-rate/ has at least 1 committed capture', () => {
    expect(farmRateJsonFiles.length, `walked ${FARM_RATE_DIR}`).toBeGreaterThanOrEqual(1);
  });

  it('provenance completeness, both directions: every farm-rate/ file has a README row, every row names a file that exists', () => {
    const readmeText = readFileSync(README_PATH, 'utf8');
    const headingMatches = [...readmeText.matchAll(/^## `([^`]+)`$/gm)].map((m) => m[1]);
    const namedFiles = new Set(headingMatches);

    const missingRows = farmRateJsonFiles.filter((f) => !namedFiles.has(f));
    const danglingRows = headingMatches.filter((f) => !farmRateJsonFiles.includes(f));

    expect(missingRows, `farm-rate files with no README row: ${missingRows.join(', ')}`).toEqual([]);
    expect(danglingRows, `README rows naming a file that does not exist: ${danglingRows.join(', ')}`).toEqual([]);
  });

  it('committed-file digest: each farm-rate/ file\'s SHA-256 equals the value its README row records', () => {
    const readmeText = readFileSync(README_PATH, 'utf8');
    const sections = readmeText.split(/^## /m).slice(1);
    const recordedByFile = new Map<string, string>();
    for (const section of sections) {
      const nameMatch = section.match(/^`([^`]+)`/);
      const shaMatch = section.match(/SHA-256 \(committed file\) \| `([0-9a-f]{64})`/);
      if (nameMatch && shaMatch) recordedByFile.set(nameMatch[1], shaMatch[1]);
    }
    const mismatches: string[] = [];
    for (const file of farmRateJsonFiles) {
      const recorded = recordedByFile.get(file);
      expect(recorded, `${file} has no parsable SHA-256 (committed file) row`).toBeDefined();
      const actual = sha256(join(FARM_RATE_DIR, file));
      if (actual !== recorded) mismatches.push(`${file}: recorded ${recorded}, actual ${actual}`);
    }
    expect(mismatches, mismatches.join('\n')).toEqual([]);
  });
});
