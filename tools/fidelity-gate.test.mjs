import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CI_FIDELITY_PATH = join(root, '.github/workflows/ci-fidelity.yml');

/**
 * Extracts one top-level `jobs.<name>:` block's raw text (from its header line up to, but not
 * including, the next 2-space-indented `key:` line, or EOF). Deliberately dumb text slicing,
 * not a full YAML parse — copied from `tools/design-system-gate.test.mjs`'s own stated
 * convention (regex/text checks on workflow files, no YAML-parsing dependency).
 */
function extractJobBlock(workflowText, jobName) {
  const lines = workflowText.split('\n');
  const startIndex = lines.findIndex((line) => new RegExp(`^  ${jobName}:\\s*$`).test(line));
  if (startIndex === -1) return null;

  let endIndex = lines.length;
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    if (/^  [A-Za-z0-9_-]+:\s*$/.test(lines[i])) {
      endIndex = i;
      break;
    }
  }
  return lines.slice(startIndex, endIndex).join('\n');
}

/** Splits a job block into its `steps:` entries (each starting at a `- name:` or `- uses:` line). */
function extractSteps(jobBlock) {
  const stepsIndex = jobBlock.indexOf('\n    steps:');
  if (stepsIndex === -1) return [];
  const stepsText = jobBlock.slice(stepsIndex);
  const lines = stepsText.split('\n');

  const steps = [];
  let current = [];
  for (const line of lines) {
    if (/^      - (name|uses):/.test(line)) {
      if (current.length > 0) steps.push(current.join('\n'));
      current = [line];
    } else if (current.length > 0) {
      current.push(line);
    }
  }
  if (current.length > 0) steps.push(current.join('\n'));
  return steps;
}

function stepIf(stepText) {
  const match = stepText.match(/^\s*if:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

function stepFails(stepText) {
  return /\bexit\s+1\b/.test(stepText);
}

/** Every quoted `- '...'` list item appearing in `text`. */
function extractQuotedListLines(text) {
  const re = /^\s*-\s*'([^']+)'\s*$/gm;
  const out = [];
  let match;
  while ((match = re.exec(text))) {
    out.push(match[1]);
  }
  return out;
}

describe('fidelity-gate-required aggregator (design.md R-2/R-3, SBC-19 idiom)', () => {
  const workflowText = readFileSync(CI_FIDELITY_PATH, 'utf8');
  const jobBlock = extractJobBlock(workflowText, 'fidelity-gate-required');

  it('exists in ci-fidelity.yml', () => {
    expect(jobBlock).not.toBeNull();
  });

  it('runs unconditionally (if: always()) so it evaluates even when fidelity-gate failed/was skipped/cancelled', () => {
    expect(jobBlock).toMatch(/^\s*if:\s*always\(\)\s*$/m);
  });

  const steps = extractSteps(jobBlock ?? '');

  it('has at least one step', () => {
    expect(steps.length).toBeGreaterThan(0);
  });

  it('has a step that fails the job when the fidelity filter matched but fidelity-gate did not succeed', () => {
    const enforcing = steps.find((step) => {
      const cond = stepIf(step);
      return (
        cond != null &&
        /needs\.changes\.outputs\.fidelity\s*==\s*'true'/.test(cond) &&
        /needs\.fidelity-gate\.result\s*!=\s*'success'/.test(cond) &&
        stepFails(step)
      );
    });
    expect(enforcing).toBeDefined();
  });

  it(
    'no step treats a skipped fidelity-gate result as success when the filter matched — the exact anti-pattern ' +
      "windows-ci/visual-ci demonstrate is not a gate (a step whose `if` branches on result == 'skipped' and " +
      'whose `run` does not fail)',
    () => {
      const selfGreeningSteps = steps.filter((step) => {
        const cond = stepIf(step);
        if (cond == null) return false;
        const branchesOnSkipped = /result\s*==\s*'skipped'/.test(cond);
        return branchesOnSkipped && !stepFails(step);
      });
      expect(selfGreeningSteps).toEqual([]);
    },
  );
});

describe('the fidelity-gate job step itself (FID-09, FID-10, edge case 5)', () => {
  const workflowText = readFileSync(CI_FIDELITY_PATH, 'utf8');
  const jobBlock = extractJobBlock(workflowText, 'fidelity-gate');
  const steps = extractSteps(jobBlock ?? '');

  it('names the domain "fidelity" filename filter in its run command', () => {
    const runStep = steps.find((step) => /pnpm vitest run --project @bombfarm\/domain fidelity\b/.test(step));
    expect(runStep).toBeDefined();
  });

  it('has no --passWithNoTests anywhere in the job (a zero-match filter must exit 1, not pass)', () => {
    expect(jobBlock).not.toBeNull();
    expect(jobBlock).not.toContain('--passWithNoTests');
  });

  it('has no continue-on-error anywhere in the job', () => {
    expect(jobBlock).not.toBeNull();
    expect(jobBlock).not.toContain('continue-on-error');
  });

  it('also runs the tools project (the guard on this very workflow)', () => {
    const runStep = steps.find((step) => /pnpm vitest run --project tools\b/.test(step));
    expect(runStep).toBeDefined();
  });
});

describe('path-filter parity (FID-08)', () => {
  const workflowText = readFileSync(CI_FIDELITY_PATH, 'utf8');
  const FID_08_PATHS = ['apps/desktop/**', 'packages/game-data/**', 'packages/domain/**'];

  it('on.push.paths and the dorny/paths-filter list are the same set', () => {
    const pushSection = workflowText.slice(workflowText.indexOf('paths:'), workflowText.indexOf('pull_request:'));
    const pushPaths = extractQuotedListLines(pushSection);

    const filtersStart = workflowText.indexOf('filters: |');
    const filterSectionEnd = workflowText.indexOf('\n\n', filtersStart);
    const filterSection = workflowText.slice(filtersStart, filterSectionEnd === -1 ? undefined : filterSectionEnd);
    const filterPaths = extractQuotedListLines(filterSection);

    expect(pushPaths.length).toBeGreaterThan(0);
    expect(filterPaths.length).toBeGreaterThan(0);
    expect([...pushPaths].sort()).toEqual([...filterPaths].sort());
  });

  it('both lists contain all three FID-08 paths (apps/desktop, packages/game-data, packages/domain)', () => {
    for (const p of FID_08_PATHS) {
      expect(workflowText).toContain(`'${p}'`);
    }
  });

  it('carries the same "keep in sync" comment convention as ci-web.yml/ci-desktop.yml', () => {
    expect(workflowText).toMatch(/Keep in sync with the dorny\/paths-filter list/);
  });
});

// ---------------------------------------------------------------------------------------------
// Source guards over the F4 test files (design §5 devices 5 and 6; T9's own scope)
// ---------------------------------------------------------------------------------------------

const F4_HELPERS = [
  'fidelity-pair.ts',
  'fidelity-gate-error.ts',
  'fidelity-grade.ts',
  'fidelity-compare.ts',
  'fidelity-gate.ts',
].map((f) => join(root, 'packages/domain/tests/helpers', f));

const F4_TESTS = [
  'fidelity-pair.test.ts',
  'fidelity-grade.test.ts',
  'fidelity-compare.test.ts',
  'fidelity-gate.test.ts',
  'fidelity-gate-discrimination.test.ts',
].map((f) => join(root, 'packages/domain/tests', f));

const F4_FILES = [...F4_HELPERS, ...F4_TESTS];

describe('F4 file inventory', () => {
  it('every declared F4 file exists (the source guards below would silently check nothing otherwise)', () => {
    for (const file of F4_FILES) {
      expect(existsSync(file), file).toBe(true);
    }
  });
});

/** True when `existsSync(...)` guards a bare `return` with no `throw` nearby (the requireBuildOutput anti-pattern). */
function hasExistsSyncGuardedReturn(text) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!/existsSync\(/.test(lines[i])) continue;
    const window = lines.slice(i, i + 5).join('\n');
    if (/\breturn\b/.test(window) && !/\bthrow\b/.test(window)) {
      return true;
    }
  }
  return false;
}

/**
 * Extracts each `it(...)`/`test(...)` call's full source text — including any chained
 * modifiers such as `.only`/`.concurrent`/`.skip` — from the call's opening `(` to its
 * balanced closing `)`, via paren-depth counting (dumb, no string/template-literal awareness,
 * same convention as `extractJobBlock`/`extractSteps` above).
 *
 * Anchored to the start of a line (only leading whitespace before the token) so prose that
 * merely contains the word "test" or "it" followed by a parenthesis in a comment — e.g. this
 * very file's helper doc-comment "cannot be reassembled wrongly per-test (design TD-1)" over in
 * `fidelity-gate.ts` — can never be mistaken for a call site. This is the same self-trip hazard
 * `--passWithNoTests` caused against a bare `toContain` check on workflow comment text; real
 * `it(`/`test(` declarations in this codebase always start their line.
 */
function extractTestCallBodies(text) {
  const bodies = [];
  const callRe = /^[ \t]*(?:it|test)(?:\.\w+)*\s*\(/gm;
  let match;
  while ((match = callRe.exec(text))) {
    const openIndex = match.index + match[0].length - 1;
    let depth = 0;
    let i = openIndex;
    for (; i < text.length; i += 1) {
      if (text[i] === '(') depth += 1;
      else if (text[i] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    bodies.push(text.slice(openIndex, i + 1));
  }
  return bodies;
}

/**
 * True when some test body contains a guard-clause-shaped bare `return;` — no value, no
 * `throw` — e.g. `if (cond) return;`. This is the `requireBuildOutput`-callsite shape
 * (`apps/web/src/tests/team-plan-worker-bundle.test.ts`'s `if (!requireBuildOutput(...)) return;`)
 * generalized past its one committed instance of `existsSync`-guarded-return: any bare early
 * return silently skips the rest of the test's assertions without failing loudly.
 *
 * Scoped to `it(...)`/`test(...)` call bodies rather than the whole file: a bare `return;`
 * inside an ordinary helper function (e.g. `assertExportCaptureIsUsable` in `fidelity-gate.ts`,
 * a documented, non-degraded early-out that a caller's *later* assertions are unaffected by) is
 * not the "a test silently doesn't run" failure mode this guards against.
 */
function hasBareEarlyReturnInTestBody(text) {
  const BARE_RETURN_RE = /\bif\s*\([^;{}]*?\)\s*\{?\s*return\s*;\s*\}?/;
  return extractTestCallBodies(text).some((body) => BARE_RETURN_RE.test(body));
}

describe('no-skip source guard — none of the ten F4 files may skip (R-5, the catalog-v4 quarantine precedent)', () => {
  for (const file of F4_FILES) {
    const label = file.slice(root.length + 1).replace(/\\/g, '/');

    it(`${label}: no describe.skip / it.skip / test.skip / .todo / .concurrent.skip (either chain order)`, () => {
      const text = readFileSync(file, 'utf8');
      expect(text).not.toMatch(/\bdescribe\.skip\b/);
      expect(text).not.toMatch(/\bit\.skip\(/);
      expect(text).not.toMatch(/\btest\.skip\(/);
      expect(text).not.toMatch(/\.todo\(/);
      expect(text).not.toMatch(/\b(?:describe|it|test)\.concurrent\.skip\(/);
      expect(text).not.toMatch(/\b(?:describe|it|test)\.skip\.concurrent\(/);
    });

    it(`${label}: no existsSync-guarded return (the fail-loud loader must throw, never silently bail)`, () => {
      const text = readFileSync(file, 'utf8');
      expect(hasExistsSyncGuardedReturn(text)).toBe(false);
    });

    it(`${label}: no bare early return inside a test body (the requireBuildOutput anti-pattern, generalized past existsSync)`, () => {
      const text = readFileSync(file, 'utf8');
      expect(hasBareEarlyReturnInTestBody(text)).toBe(false);
    });
  }
});

describe('no second tolerance (edge case 5) — SHEET_ABS_TOL is imported, never redefined', () => {
  for (const file of F4_FILES) {
    const label = file.slice(root.length + 1).replace(/\\/g, '/');

    it(`${label}: declares no ABS_TOL-shaped constant of its own`, () => {
      const text = readFileSync(file, 'utf8');
      const declarations = text.match(/\bconst\s+\w*ABS_TOL\w*\s*[:=]/g) ?? [];
      expect(declarations).toEqual([]);
    });
  }

  it('fidelity-compare.ts imports SHEET_ABS_TOL rather than declaring it', () => {
    const text = readFileSync(join(root, 'packages/domain/tests/helpers/fidelity-compare.ts'), 'utf8');
    expect(text).toMatch(/import\s*\{\s*SHEET_ABS_TOL\s*\}\s*from/);
  });
});
