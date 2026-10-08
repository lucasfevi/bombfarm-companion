/**
 * Runs `tools/domain-coverage.mjs` as a child process against a throwaway package tree, because a
 * ratchet whose findings do not become a non-zero exit code guards nothing — and the pure-function
 * tests beside it cannot see that. The `--root` flag points the CLI at the fixture for the
 * baseline, the source scan and git; `--summary` replaces the long instrumented measurement.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIN_BASELINE_FILES, canonicalBaselineText } from './domain-coverage-core.mjs';

const CLI = resolve(dirname(fileURLToPath(import.meta.url)), 'domain-coverage.mjs');
const FILE_COUNT = MIN_BASELINE_FILES + 2;
const TYPES_ONLY = 'src/types.ts';
const NEVER_LOADED = 'src/never-loaded.ts';
const BASELINE = 'packages/domain/coverage-baseline.json';
const SLOW = 60_000;

function sourceName(index) {
  return `src/file-${String(index).padStart(3, '0')}.ts`;
}

function writeSource(dir, name, body) {
  const full = join(dir, 'packages/domain', name);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body);
}

function writeFixtureSources(dir) {
  for (let index = 0; index < FILE_COUNT; index += 1) writeSource(dir, sourceName(index), `export const value${index} = ${index};\n`);
  writeSource(dir, TYPES_ONLY, 'export type Id = string;\n');
  writeSource(dir, NEVER_LOADED, 'export function neverCalled() {\n  return 1;\n}\n');
}

function metric(covered) {
  return { total: 10, covered, skipped: 0, pct: covered * 10 };
}

function zeroEntry(total) {
  const zero = { total, covered: 0, skipped: 0, pct: total === 0 ? 100 : 0 };
  return { lines: zero, statements: zero, functions: zero, branches: zero };
}

function writeSummary(dir, name, { covered = {}, extraFiles = [], linuxShaped = false } = {}) {
  const entries = {};
  const names = [...Array.from({ length: FILE_COUNT }, (_, index) => sourceName(index)), ...extraFiles];
  for (const file of names) {
    const count = covered[file] ?? 8;
    entries[join(dir, 'packages/domain', file)] = {
      lines: metric(count),
      statements: metric(count),
      functions: metric(count),
      branches: metric(count),
    };
  }
  if (linuxShaped) {
    entries[join(dir, 'packages/domain', NEVER_LOADED)] = zeroEntry(3);
    entries[join(dir, 'packages/domain', TYPES_ONLY)] = zeroEntry(0);
  }
  writeFileSync(join(dir, name), JSON.stringify({ total: { lines: metric(8), statements: metric(8), functions: metric(8), branches: metric(8) }, ...entries }));
}

function cli(dir, args) {
  const result = spawnSync(process.execPath, [CLI, ...args, '--root', dir], { cwd: dir, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function git(dir, args) {
  const result = spawnSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.com', '-c', 'commit.gpgsign=false', ...args], {
    cwd: dir,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
}

function readBaselineJson(dir) {
  return JSON.parse(readFileSync(join(dir, BASELINE), 'utf8'));
}

function writeBaselineJson(dir, baseline) {
  writeFileSync(join(dir, BASELINE), canonicalBaselineText(baseline));
}

let workspace;
let template;

beforeAll(() => {
  workspace = mkdtempSync(join(tmpdir(), 'domain-coverage-cli-'));
  template = join(workspace, 'template');
  mkdirSync(template);
  writeFixtureSources(template);
  writeSummary(template, 'summary-base.json');
  const created = cli(template, ['update', '--summary', 'summary-base.json']);
  if (created.status !== 0) throw new Error(`fixture baseline was not created: ${created.stderr}`);
}, SLOW);

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

let counter = 0;
function freshCopy() {
  counter += 1;
  const dir = join(workspace, `case-${counter}`);
  cpSync(template, dir, { recursive: true });
  writeSummary(dir, 'summary-base.json');
  return dir;
}

describe('check exits non-zero for every kind of finding and zero when there is none', () => {
  it('exits 0 and says there are no findings when the measurement equals the baseline', () => {
    const dir = freshCopy();
    const result = cli(dir, ['check', '--summary', 'summary-base.json']);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('ratchet: no findings');
  }, SLOW);

  it('exits 1 and names the file and metric on a regression', () => {
    const dir = freshCopy();
    writeSummary(dir, 'summary-low.json', { covered: { [sourceName(5)]: 3 } });
    const result = cli(dir, ['check', '--summary', 'summary-low.json']);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain(`[regression] ${sourceName(5)}: statements fell from 80% to 30%`);
  }, SLOW);

  it('exits 1 on a new source file the baseline does not record', () => {
    const dir = freshCopy();
    writeSource(dir, 'src/file-new.ts', 'export const added = 1;\n');
    writeSummary(dir, 'summary-new.json', { extraFiles: ['src/file-new.ts'] });
    const result = cli(dir, ['check', '--summary', 'summary-new.json']);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('[unrecorded-file] src/file-new.ts');
  }, SLOW);

  it('exits 1 on a malformed baseline, valid JSON or not', () => {
    const dir = freshCopy();
    writeFileSync(join(dir, BASELINE), '{ "files": 3 }\n');
    const malformed = cli(dir, ['check', '--summary', 'summary-base.json']);
    expect(malformed.status).toBe(1);
    expect(malformed.stdout).toContain('[invalid-baseline]');

    writeFileSync(join(dir, BASELINE), '{ not json');
    const unparsable = cli(dir, ['check', '--summary', 'summary-base.json']);
    expect(unparsable.status).toBe(1);
    expect(unparsable.stderr).toContain('is not valid JSON');
  }, SLOW);

  it('exits 1 when there is no baseline to compare with', () => {
    const dir = freshCopy();
    rmSync(join(dir, BASELINE));
    const result = cli(dir, ['check', '--summary', 'summary-base.json']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('does not exist');
  }, SLOW);

  it('exits 1 when the summary is unreadable, rather than swallowing the error', () => {
    const dir = freshCopy();
    writeFileSync(join(dir, 'summary-bad.json'), '{ not json');
    const result = cli(dir, ['check', '--summary', 'summary-bad.json']);
    expect(result.status).toBe(1);
    expect(result.stderr).not.toBe('');
  }, SLOW);

  it('exits 1 when the summary is missing entirely', () => {
    const dir = freshCopy();
    const result = cli(dir, ['check', '--summary', 'no-such-summary.json']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('does not exist');
  }, SLOW);

  it('exits 1 when the measurement is below the floor', () => {
    const dir = freshCopy();
    const summary = JSON.parse(readFileSync(join(dir, 'summary-base.json'), 'utf8'));
    const keys = Object.keys(summary).filter((key) => key !== 'total');
    const tiny = { total: summary.total, ...Object.fromEntries(keys.slice(0, 5).map((key) => [key, summary[key]])) };
    writeFileSync(join(dir, 'summary-tiny.json'), JSON.stringify(tiny));
    const result = cli(dir, ['check', '--summary', 'summary-tiny.json']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('below the floor');
  }, SLOW);

  it('rejects an unknown command with exit code 2', () => {
    const result = cli(freshCopy(), ['frobnicate']);
    expect(result.status).toBe(2);
  }, SLOW);
});

describe('update refuses regressions and writes improvements', () => {
  it('exits 1, names the file, and leaves the baseline byte-identical on a regression', () => {
    const dir = freshCopy();
    const before = readFileSync(join(dir, BASELINE), 'utf8');
    writeSummary(dir, 'summary-low.json', { covered: { [sourceName(9)]: 2 } });
    const result = cli(dir, ['update', '--summary', 'summary-low.json']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('update refused');
    expect(result.stderr).toContain(`[regression] ${sourceName(9)}`);
    expect(readFileSync(join(dir, BASELINE), 'utf8')).toBe(before);
  }, SLOW);

  it('exits 0 and records an improvement, then says there is nothing to write', () => {
    const dir = freshCopy();
    writeSummary(dir, 'summary-high.json', { covered: { [sourceName(9)]: 10 } });
    const written = cli(dir, ['update', '--summary', 'summary-high.json']);
    expect(written.status, written.stderr).toBe(0);
    expect(written.stdout).toContain('wrote');
    expect(readBaselineJson(dir).files[sourceName(9)]).toEqual({ statements: 100, branches: 100, functions: 100, lines: 100 });

    const again = cli(dir, ['update', '--summary', 'summary-high.json']);
    expect(again.status).toBe(0);
    expect(again.stdout).toContain('nothing written');
  }, SLOW);

  it('exits 0 and records a deliberate decline through --waive with a reason', () => {
    const dir = freshCopy();
    writeSummary(dir, 'summary-low.json', { covered: { [sourceName(9)]: 2 } });
    const result = cli(dir, ['update', '--summary', 'summary-low.json', '--waive', sourceName(9), '--reason', 'dead code removed']);
    expect(result.status, result.stderr).toBe(0);
    const baseline = readBaselineJson(dir);
    expect(baseline.files[sourceName(9)].statements).toBe(20);
    expect(baseline.waivers[sourceName(9)].reason).toBe('dead code removed');
  }, SLOW);
});

describe('guard-base compares the head baseline with a git ref', () => {
  function repoWithBase() {
    const dir = freshCopy();
    git(dir, ['init', '-q']);
    git(dir, ['add', 'packages/domain/src']);
    git(dir, ['commit', '-q', '-m', 'sources only']);
    git(dir, ['tag', 'without-baseline']);
    git(dir, ['add', BASELINE]);
    git(dir, ['commit', '-q', '-m', 'baseline']);
    git(dir, ['tag', 'with-baseline']);
    return dir;
  }

  it('exits 0 when no recorded number is lower, and prints the removed and added review', () => {
    const dir = repoWithBase();
    const result = cli(dir, ['guard-base', '--base', 'with-baseline']);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('no recorded number is lower');
    expect(result.stdout).toContain('baseline files removed since the base: none');
    expect(result.stdout).toContain('baseline files added since the base: none');
  }, SLOW);

  it('exits 1 and names file, metric and numbers when head lowers a recorded number', () => {
    const dir = repoWithBase();
    const baseline = readBaselineJson(dir);
    baseline.files[sourceName(4)].branches = 10;
    writeBaselineJson(dir, baseline);
    const result = cli(dir, ['guard-base', '--base', 'with-baseline']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`[lowered-without-waiver] ${sourceName(4)}: recorded branches was lowered from 80% to 10%`);
  }, SLOW);

  it('exits 0 when the lowered number comes with a new waiver', () => {
    const dir = repoWithBase();
    const baseline = readBaselineJson(dir);
    baseline.files[sourceName(4)].branches = 10;
    baseline.waivers[sourceName(4)] = { reason: 'declined on purpose', ...baseline.files[sourceName(4)] };
    writeBaselineJson(dir, baseline);
    expect(cli(dir, ['guard-base', '--base', 'with-baseline']).status).toBe(0);
  }, SLOW);

  it('exits 1 when the base ref does not resolve', () => {
    const dir = repoWithBase();
    const result = cli(dir, ['guard-base', '--base', 'origin/no-such-branch']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('does not resolve');
  }, SLOW);

  it('exits 0 with a notice when the base has no baseline file', () => {
    const dir = repoWithBase();
    const result = cli(dir, ['guard-base', '--base', 'without-baseline']);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('nothing to compare');
  }, SLOW);

  it('exits 1 when head drops a file that still exists on disk', () => {
    const dir = repoWithBase();
    const baseline = readBaselineJson(dir);
    delete baseline.files[sourceName(6)];
    writeBaselineJson(dir, baseline);
    const result = cli(dir, ['guard-base', '--base', 'with-baseline']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`[removed-while-on-disk] ${sourceName(6)}`);
  }, SLOW);

  it('exits 1 when a file moves to a new path with the same name and lower numbers, and lists both paths', () => {
    const dir = repoWithBase();
    const baseline = readBaselineJson(dir);
    const moved = 'src/sub/file-007.ts';
    writeSource(dir, moved, readFileSync(join(dir, 'packages/domain', sourceName(7)), 'utf8'));
    rmSync(join(dir, 'packages/domain', sourceName(7)));
    baseline.files[moved] = { statements: 40, branches: 40, functions: 40, lines: 40 };
    delete baseline.files[sourceName(7)];
    writeBaselineJson(dir, baseline);
    const result = cli(dir, ['guard-base', '--base', 'with-baseline']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`[renamed-with-lower-numbers] ${moved}`);
    expect(result.stdout).toContain(sourceName(7));
    expect(result.stdout).toContain(moved);
  }, SLOW);

  it('exits 1 when the head baseline is missing', () => {
    const dir = repoWithBase();
    rmSync(join(dir, BASELINE));
    expect(existsSync(join(dir, BASELINE))).toBe(false);
    expect(cli(dir, ['guard-base', '--base', 'with-baseline']).status).toBe(1);
  }, SLOW);

  it('exits 2 without --base', () => {
    expect(cli(freshCopy(), ['guard-base']).status).toBe(2);
  }, SLOW);
});

describe('guard-base refuses a malformed head baseline', () => {
  it('exits 1 and says the head baseline is malformed', () => {
    const dir = freshCopy();
    git(dir, ['init', '-q']);
    git(dir, ['add', '.']);
    git(dir, ['commit', '-q', '-m', 'base']);
    git(dir, ['tag', 'with-baseline']);
    writeFileSync(join(dir, BASELINE), '{ "files": 3 }\n');
    const result = cli(dir, ['guard-base', '--base', 'with-baseline']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('the head baseline is malformed');
    expect(result.stderr, 'a clean refusal, not a crash').not.toContain('TypeError');
  }, SLOW);
});

describe('the same code is judged identically from a Windows-shaped and a Linux-shaped report', () => {
  it('records the never-loaded file as an allowance and the type-only file as unmeasured, with no rows for either', () => {
    const baseline = readBaselineJson(freshCopy());
    expect(Object.keys(baseline.zeroCoverageAllowed)).toEqual([NEVER_LOADED]);
    expect(baseline.unmeasured).toEqual([TYPES_ONLY]);
    expect(Object.keys(baseline.files)).not.toContain(NEVER_LOADED);
    expect(Object.keys(baseline.files)).not.toContain(TYPES_ONLY);
  }, SLOW);

  it('check is green on both shapes', () => {
    const dir = freshCopy();
    writeSummary(dir, 'summary-linux.json', { linuxShaped: true });
    const windows = cli(dir, ['check', '--summary', 'summary-base.json']);
    const linux = cli(dir, ['check', '--summary', 'summary-linux.json']);
    expect(windows.status, windows.stdout).toBe(0);
    expect(linux.status, linux.stdout).toBe(0);
  }, SLOW);

  it('update writes the same baseline from both shapes: nothing, byte-identical', () => {
    const dir = freshCopy();
    const before = readFileSync(join(dir, BASELINE), 'utf8');
    writeSummary(dir, 'summary-linux.json', { linuxShaped: true });
    const fromLinux = cli(dir, ['update', '--summary', 'summary-linux.json']);
    expect(fromLinux.status, fromLinux.stderr).toBe(0);
    expect(readFileSync(join(dir, BASELINE), 'utf8')).toBe(before);
    const fromWindows = cli(dir, ['update', '--summary', 'summary-base.json']);
    expect(fromWindows.status, fromWindows.stderr).toBe(0);
    expect(readFileSync(join(dir, BASELINE), 'utf8')).toBe(before);
  }, SLOW);

  it('a never-loaded runtime file with no allowance fails on both shapes', () => {
    const dir = freshCopy();
    const baseline = readBaselineJson(dir);
    delete baseline.zeroCoverageAllowed[NEVER_LOADED];
    writeBaselineJson(dir, baseline);
    writeSummary(dir, 'summary-linux.json', { linuxShaped: true });
    const windows = cli(dir, ['check', '--summary', 'summary-base.json']);
    const linux = cli(dir, ['check', '--summary', 'summary-linux.json']);
    expect(windows.status).toBe(1);
    expect(windows.stdout).toContain(`[source-not-accounted] ${NEVER_LOADED}`);
    expect(linux.status).toBe(1);
    expect(linux.stdout).toContain(`[source-not-accounted] ${NEVER_LOADED}`);
    expect(linux.stdout).toContain(`[unallowed-zero-coverage] ${NEVER_LOADED}`);
  }, SLOW);
});

describe('the split commands CI runs as parallel jobs', () => {
  function writeBlobs(dir, names) {
    const blobs = join(dir, 'coverage/domain-blobs');
    mkdirSync(blobs, { recursive: true });
    for (const name of names) writeFileSync(join(blobs, name), '{}');
  }

  it('merge-and-compare refuses to merge when either pass left no blob, naming each missing one, before running anything', () => {
    const dir = freshCopy();
    const none = cli(dir, ['merge-and-compare']);
    expect(none.status).toBe(1);
    expect(none.stderr).toContain('left no main.json, solver.json under coverage/domain-blobs');

    writeBlobs(dir, ['main.json']);
    const onlyMain = cli(dir, ['merge-and-compare']);
    expect(onlyMain.status).toBe(1);
    expect(onlyMain.stderr).toContain('left no solver.json under coverage/domain-blobs');
    expect(existsSync(join(dir, 'coverage/domain-results'))).toBe(false);
  }, SLOW);

  it('merge-and-compare refuses a stray blob, which --merge-reports would silently fold into the numbers', () => {
    const dir = freshCopy();
    writeBlobs(dir, ['main.json', 'solver.json', 'old-main.json']);
    const result = cli(dir, ['merge-and-compare']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('coverage/domain-blobs holds old-main.json besides main.json and solver.json');
    expect(existsSync(join(dir, 'coverage/domain-results'))).toBe(false);
  }, SLOW);

  it.each(['measure-domain', 'measure-solver', 'merge-and-compare'])('%s takes no --summary: it exists to measure', (command) => {
    const result = cli(freshCopy(), [command, '--summary', 'summary-base.json']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('--summary is only valid with check or update');
  }, SLOW);

  it('the usage names every command', () => {
    const result = cli(freshCopy(), ['bogus']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('[check|update|guard-base|measure-domain|measure-solver|merge-and-compare]');
  }, SLOW);
});
