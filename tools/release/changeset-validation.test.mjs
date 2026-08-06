import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  readWorkspacePackageNames,
  runCli,
  validateChangesets,
} from './changeset-validation.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const fixturesDir = join(fileURLToPath(new URL('.', import.meta.url)), '__fixtures__');
const workspacePackages = readWorkspacePackageNames(repoRoot);
const fixture = (name) => join(fixturesDir, name);

describe('validateChangesets', () => {
  it('accepts a valid single-package changeset', () => {
    const problems = validateChangesets({
      files: [fixture('valid-single.md')],
      workspacePackageNames: workspacePackages,
    });
    expect(problems).toEqual([]);
  });

  it('accepts multiple packages in one changeset', () => {
    const problems = validateChangesets({
      files: [fixture('valid-multi.md')],
      workspacePackageNames: workspacePackages,
    });
    expect(problems).toEqual([]);
  });

  it('reports unknown package names', () => {
    const problems = validateChangesets({
      files: [fixture('unknown-package.md')],
      workspacePackageNames: workspacePackages,
    });
    expect(problems).toEqual([
      {
        file: 'unknown-package.md',
        kind: 'unknown-package',
        detail: 'package "@bombfarm/unknown" is not in the workspace',
      },
    ]);
  });

  it('reports invalid bump kinds including typos and punctuation', () => {
    const pathcProblems = validateChangesets({
      files: [fixture('invalid-bump-pathc.md')],
      workspacePackageNames: workspacePackages,
    });
    expect(pathcProblems).toEqual([
      {
        file: 'invalid-bump-pathc.md',
        kind: 'invalid-bump',
        detail: 'invalid bump kind "pathc" for "@bombfarm/ui"',
      },
    ]);

    const exclaimProblems = validateChangesets({
      files: [fixture('invalid-bump-major-exclaim.md')],
      workspacePackageNames: workspacePackages,
    });
    expect(exclaimProblems).toEqual([
      {
        file: 'invalid-bump-major-exclaim.md',
        kind: 'invalid-bump',
        detail: 'invalid bump kind "major!" for "@bombfarm/ui"',
      },
    ]);
  });

  it('reports empty bump kinds as invalid-bump', () => {
    const problems = validateChangesets({
      files: [fixture('invalid-bump-empty.md')],
      workspacePackageNames: workspacePackages,
    });
    expect(problems).toEqual([
      {
        file: 'invalid-bump-empty.md',
        kind: 'invalid-bump',
        detail: 'invalid bump kind "" for "@bombfarm/ui"',
      },
    ]);
  });

  it('reports malformed frontmatter', () => {
    const noOpening = validateChangesets({
      files: [fixture('malformed-no-opening.md')],
      workspacePackageNames: workspacePackages,
    });
    expect(noOpening[0].kind).toBe('malformed-frontmatter');

    const noClosing = validateChangesets({
      files: [fixture('malformed-no-closing.md')],
      workspacePackageNames: workspacePackages,
    });
    expect(noClosing[0].kind).toBe('malformed-frontmatter');
  });

  it('reports empty summaries', () => {
    const problems = validateChangesets({
      files: [fixture('empty-summary.md')],
      workspacePackageNames: workspacePackages,
    });
    expect(problems).toEqual([
      {
        file: 'empty-summary.md',
        kind: 'empty-summary',
        detail: 'changeset summary is empty',
      },
    ]);
  });

  it('reports multiple problems in one file', () => {
    const problems = validateChangesets({
      files: [fixture('multiple-problems.md')],
      workspacePackageNames: workspacePackages,
    });
    expect(problems).toHaveLength(2);
    expect(problems.map((problem) => problem.kind)).toEqual([
      'unknown-package',
      'invalid-bump',
    ]);
  });
});

describe('changeset-validation CLI', () => {
  const cliPath = fileURLToPath(new URL('./changeset-validation.mjs', import.meta.url));

  it('exits 0 for valid fixture files', () => {
    const result = spawnSync(
      process.execPath,
      [cliPath, 'tools/release/__fixtures__/valid-single.md'],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });

  it('exits 1 and prints offending filenames for invalid fixtures', () => {
    const result = spawnSync(
      process.execPath,
      [cliPath, 'tools/release/__fixtures__/unknown-package.md'],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unknown-package.md');
    expect(result.stderr).toContain('unknown-package');
  });

  it('runCli returns 0 when validating only valid fixtures', () => {
    expect(
      runCli([
        'tools/release/__fixtures__/valid-single.md',
        'tools/release/__fixtures__/valid-multi.md',
      ]),
    ).toBe(0);
  });
});
