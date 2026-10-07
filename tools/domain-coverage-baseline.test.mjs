/**
 * Guards the committed per-file coverage baseline of `packages/domain` without running any
 * coverage: it reads the baseline and the source tree. This file runs in the unfiltered
 * `repo-guards` job, so a source file added without a baseline entry, or a baseline hand-edited
 * into nonsense, fails on every pull request — not only on the ones that touch the domain
 * package and pay for the instrumented run.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  KIND,
  MIN_BASELINE_FILES,
  METRICS,
  baselineIntegrityFindings,
  canonicalBaselineText,
  coverageIgnoreHints,
  filesTheRatchetCannotSee,
} from './domain-coverage-core.mjs';
import { runtimeBearingFiles } from './domain-coverage-runtime.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PACKAGE_DIRECTORY = join(root, 'packages/domain');
const BASELINE_PATH = join(PACKAGE_DIRECTORY, 'coverage-baseline.json');

function sourceFilesOnDisk() {
  const found = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        found.push(relative(PACKAGE_DIRECTORY, full).replaceAll('\\', '/'));
      }
    }
  };
  walk(join(PACKAGE_DIRECTORY, 'src'));
  return found.sort();
}

function everyFileUnderSource() {
  const found = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else found.push(relative(PACKAGE_DIRECTORY, full).replaceAll('\\', '/'));
    }
  };
  walk(join(PACKAGE_DIRECTORY, 'src'));
  return found.sort();
}

const text = existsSync(BASELINE_PATH) ? readFileSync(BASELINE_PATH, 'utf8') : '';
const baseline = text === '' ? null : JSON.parse(text);
const sourceFiles = sourceFilesOnDisk();
const runtimeFiles = runtimeBearingFiles(PACKAGE_DIRECTORY, sourceFiles);
const findings = baseline === null ? [] : baselineIntegrityFindings({ baseline, sourceFiles, runtimeFiles });

function namesOf(kind) {
  return findings.filter((item) => item.kind === kind).map((item) => item.file ?? item.message);
}

describe('packages/domain/coverage-baseline.json', () => {
  it('exists and parses', () => {
    expect(existsSync(BASELINE_PATH), 'packages/domain/coverage-baseline.json is missing — run `pnpm coverage:domain:update`').toBe(true);
    expect(baseline).not.toBeNull();
    expect(Object.keys(baseline).sort()).toEqual(['files', 'unmeasured', 'waivers', 'zeroCoverageAllowed']);
  });

  it('finds source files to account for', () => {
    expect(sourceFiles.length).toBeGreaterThan(MIN_BASELINE_FILES);
  });

  it('is byte-for-byte its own canonical form, one line per file', () => {
    expect(text, 'the baseline was hand-edited out of canonical form; `pnpm coverage:domain:update` rewrites it').toBe(
      canonicalBaselineText(baseline),
    );
  });

  it(`records at least ${MIN_BASELINE_FILES} files`, () => {
    expect(Object.keys(baseline.files).length).toBeGreaterThanOrEqual(MIN_BASELINE_FILES);
    expect(namesOf(KIND.baselineBelowFloor)).toEqual([]);
  });

  it('every recorded file and every unmeasured entry still exists on disk', () => {
    expect(namesOf(KIND.staleBaselineEntry), 'recorded but deleted from disk').toEqual([]);
    expect(namesOf(KIND.staleUnmeasuredEntry), 'unmeasured but deleted from disk').toEqual([]);
  });

  it('every source file is recorded, unmeasured or allowed, and never listed twice', () => {
    expect(namesOf(KIND.sourceNotAccounted), 'in none of the baseline, the unmeasured list and zeroCoverageAllowed').toEqual([]);
    expect(namesOf(KIND.listedTwice), 'listed twice').toEqual([]);
  });

  it('every unmeasured file has no runtime code, by transpiling it', () => {
    const offenders = baseline.unmeasured.filter((file) => runtimeFiles.includes(file));
    expect(offenders, 'in the unmeasured list but carrying runtime code: they belong in zeroCoverageAllowed').toEqual([]);
    expect(namesOf(KIND.runtimeInUnmeasured)).toEqual([]);
  });

  it('every number is a percentage and every section has the right shape', () => {
    expect(findings.filter((item) => item.kind === KIND.invalidBaseline).map((item) => item.message)).toEqual([]);
    for (const [file, entry] of Object.entries(baseline.files)) {
      expect(Object.keys(entry), file).toEqual(METRICS);
    }
  });

  it('every zero-coverage allowance has a reason and a file that exists, and is either recorded at 0 statements or never loaded with runtime code', () => {
    expect(namesOf(KIND.invalidAllowance), 'allowances with no reason').toEqual([]);
    expect(namesOf(KIND.staleAllowance), 'allowances for a file that is gone or now has coverage').toEqual([]);
    expect(namesOf(KIND.allowanceForRuntimeFreeFile), 'allowances for a file with no coverage row and no runtime code').toEqual([]);
    for (const [file, reason] of Object.entries(baseline.zeroCoverageAllowed)) {
      expect(reason.trim(), file).not.toBe('');
      expect(existsSync(join(PACKAGE_DIRECTORY, file)), `${file} no longer exists`).toBe(true);
      if (file in baseline.files) {
        expect(baseline.files[file].statements, `${file} is allowed to have no coverage but the baseline records some`).toBe(0);
      } else {
        expect(runtimeFiles, `${file} has neither a coverage row nor runtime code`).toContain(file);
      }
    }
  });

  it('every recorded file with 0 statements covered has an allowance with a reason', () => {
    const zeroFiles = Object.entries(baseline.files)
      .filter(([, entry]) => entry.statements === 0)
      .map(([file]) => file);
    const unallowed = zeroFiles.filter((file) => !(file in baseline.zeroCoverageAllowed));
    expect(unallowed, 'no coverage and no reviewed reason').toEqual([]);
    expect(namesOf(KIND.unallowedZeroCoverage)).toEqual([]);
  });

  it('every waiver has a reason, four numbers and a file that exists', () => {
    expect(namesOf(KIND.invalidWaiver), 'waivers that are malformed').toEqual([]);
    expect(namesOf(KIND.staleWaiver), 'waivers for a file that is gone').toEqual([]);
  });

  it('has no integrity finding of any kind', () => {
    expect(findings.map((item) => item.message)).toEqual([]);
  });
});

describe('nothing under packages/domain/src can hide from the ratchet', () => {
  it('has no v8, istanbul or c8 ignore hint, which would silently raise every metric', () => {
    const offenders = sourceFiles.flatMap((file) => coverageIgnoreHints(file, readFileSync(join(PACKAGE_DIRECTORY, file), 'utf8')));
    expect(offenders, 'coverage-ignore hints (file:line)').toEqual([]);
  });

  it('holds only .ts and .json files: a .mts, .js or upper-case .TS file is invisible to the ratchet and the compiler', () => {
    expect(filesTheRatchetCannotSee(everyFileUnderSource()), 'neither .ts nor .json').toEqual([]);
  });
});
