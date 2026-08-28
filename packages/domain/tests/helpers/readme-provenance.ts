/**
 * Two directories under `fixtures/` carry a README provenance manifest — one `## \`<file>\`` section
 * per committed capture, each recording what that capture may prove and its SHA-256. The row format
 * is the contract between the manifest and these checks, so it is parsed in exactly one place: a
 * second copy would let one directory's guard keep matching rows while the other silently stopped.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';

export function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function rowNames(readmeText: string): string[] {
  return [...readmeText.matchAll(/^## `([^`]+)`$/gm)].map((m) => m[1]);
}

export function assertProvenanceComplete(readmePath: string, dataFiles: string[], label: string): void {
  const named = rowNames(readFileSync(readmePath, 'utf8'));
  const missingRows = dataFiles.filter((f) => !named.includes(f));
  const danglingRows = named.filter((f) => !dataFiles.includes(f));

  expect(missingRows, `${label} files with no README row: ${missingRows.join(', ')}`).toEqual([]);
  expect(danglingRows, `README rows naming a file that does not exist: ${danglingRows.join(', ')}`).toEqual([]);
}

export function assertRecordedDigests(dir: string, readmePath: string, dataFiles: string[]): void {
  const sections = readFileSync(readmePath, 'utf8').split(/^## /m).slice(1);
  const recordedByFile = new Map<string, string>();
  for (const section of sections) {
    const nameMatch = section.match(/^`([^`]+)`/);
    const shaMatch = section.match(/SHA-256 \(committed file\) \| `([0-9a-f]{64})`/);
    if (nameMatch && shaMatch) recordedByFile.set(nameMatch[1], shaMatch[1]);
  }

  const mismatches: string[] = [];
  for (const file of dataFiles) {
    const recorded = recordedByFile.get(file);
    expect(recorded, `${file} has no parsable SHA-256 (committed file) row`).toBeDefined();
    const actual = sha256(join(dir, file));
    if (actual !== recorded) mismatches.push(`${file}: recorded ${recorded}, actual ${actual}`);
  }
  expect(mismatches, mismatches.join('\n')).toEqual([]);
}
