import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const LINE_ENDINGS_YML_PATH = join(root, '.github/workflows/line-endings.yml');

/**
 * The shape guard for `.github/workflows/line-endings.yml`, the sibling of
 * `tools/wiki-drift-workflow.test.mjs` / `tools/ci-desktop-paths.test.mjs` /
 * `tools/fidelity-gate.test.mjs`. It pins the one property that workflow exists for and
 * that a well-meaning future edit will take away: it is **unconditional**.
 *
 * The defect `line-endings.yml` fixes was that the LF guard reached CI only through two
 * `dorny/paths-filter`-gated jobs whose union missed 57% of tracked files. Adding a
 * `paths:` key here to save CI minutes would silently reinstate exactly that hole — a
 * CRLF file can arrive with a change to *any* path, so the only correct filter is none.
 * The second property is the aggregator's failing condition: it must reject `skipped`
 * and `cancelled`, not only `failure`, because "the gate never ran" is the failure mode
 * being guarded against.
 *
 * Every predicate below is a pure function over workflow *text*, asserted twice: `true`
 * against `readFileSync` of the real file on disk, and `false` against a *string mutation
 * of that same text* — never a hand-written fixture that could drift away from the file it
 * claims to describe. Deliberately dumb text slicing, not a YAML parse — the convention
 * `tools/fidelity-gate.test.mjs`, `tools/design-system-gate.test.mjs` and
 * `tools/release-config.test.mjs` all follow (no YAML-parsing dependency).
 *
 * This file is named `line-endings-*` on purpose: `line-endings.yml` runs
 * `pnpm vitest run --project tools line-endings`, whose filename filter is a substring
 * match, so the workflow carries its own shape guard. That is why — unlike
 * `wiki-drift.yml`, whose guard is reachable only through `ci-desktop.yml`'s `quality`
 * job — this workflow needs no entry in any other workflow's path-filter list.
 */

/**
 * Lines whose trimmed content starts with `#`. `line-endings.yml` documents itself at
 * length, and its header prose necessarily names `paths:`, `dorny/paths-filter` and
 * `skipped` while explaining why it has none of them. A predicate asking about YAML
 * semantics must not be tripped by the file's own commentary about those semantics.
 */
function stripCommentLines(text) {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
}

/**
 * One top-level `jobs.<name>:` block's raw text (its header line up to, but not
 * including, the next 2-space-indented bare `key:` line, or EOF). Same helper as
 * `tools/fidelity-gate.test.mjs`.
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

/** A job block's `steps:` entries, each starting at a `- name:` or `- uses:` line. */
function extractSteps(jobBlock) {
  const stepsIndex = jobBlock.indexOf('\n    steps:');
  if (stepsIndex === -1) return [];
  const lines = jobBlock.slice(stepsIndex).split('\n');

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

// ---------------------------------------------------------------------------------------------
// Predicate 1 — the workflow is path-unfiltered (the whole point of the file)
// ---------------------------------------------------------------------------------------------

/**
 * No `paths:` / `paths-ignore:` key anywhere (trigger-level or job-level) and no
 * `dorny/paths-filter` step. Both spellings of the same regression: narrowing which
 * changes get the LF census run against them.
 */
function noPathFilter(text) {
  const code = stripCommentLines(text);
  return !/^\s*paths(-ignore)?:/m.test(code) && !/dorny\/paths-filter/.test(code);
}

// ---------------------------------------------------------------------------------------------
// Predicate 2 — the pull_request trigger is unconditional
// ---------------------------------------------------------------------------------------------

/**
 * `pull_request:` appears under `on:` as a bare key with no nested block. Any nested key —
 * `paths:`, `branches:`, or a `types:` list that drops one of the default
 * opened/synchronize/reopened events — makes some pull request escape the gate, which is
 * the same hole as a path filter wearing a different hat.
 */
function unconditionalPullRequest(text) {
  const lines = stripCommentLines(text).split('\n');
  const index = lines.findIndex((line) => /^ {2}pull_request:\s*$/.test(line));
  if (index === -1) return false;

  for (let i = index + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '') continue;
    // The first non-blank line after it must not be indented deeper than the key itself.
    return !/^ {3,}\S/.test(lines[i]);
  }
  return true;
}

// ---------------------------------------------------------------------------------------------
// Predicates 3a/3b — the aggregator fails on ANY non-success, skipped included
// ---------------------------------------------------------------------------------------------

/**
 * `line-endings-required` runs `if: always()` and carries a step that fails the job on
 * `needs.line-endings.result != 'success'`. The `!=` shape is load-bearing: it is the only
 * one that also catches `skipped` and `cancelled`.
 */
function aggregatorFailsOnAnyNonSuccess(text) {
  const jobBlock = extractJobBlock(text, 'line-endings-required');
  if (jobBlock === null) return false;
  const code = stripCommentLines(jobBlock);
  if (!/^\s*if:\s*always\(\)\s*$/m.test(code)) return false;

  return extractSteps(code).some((step) => {
    const condition = stepIf(step);
    return (
      condition !== null &&
      /needs\.line-endings\.result\s*!=\s*'success'/.test(condition) &&
      stepFails(step)
    );
  });
}

/**
 * The aggregator does NOT use the `ci-desktop-required` idiom
 * (`result == 'failure' || result == 'cancelled'`), which reports success when the needed
 * job was *skipped* — i.e. when the gate never ran at all. That idiom is defensible in
 * `ci-desktop.yml`, where a path filter legitimately skips jobs; here nothing may skip, so
 * "never ran" must be a failure. A gate that goes green for "never ran" is worse than no
 * gate, and this repo has a documented history of exactly that.
 */
function noSkippedTolerantAggregator(text) {
  const jobBlock = extractJobBlock(text, 'line-endings-required');
  if (jobBlock === null) return false;
  const code = stripCommentLines(jobBlock);
  return !/needs\.line-endings\.result\s*==\s*'(failure|cancelled|skipped)'/.test(code);
}

// ---------------------------------------------------------------------------------------------
// Predicate 4 — the job actually invokes the line-endings suite
// ---------------------------------------------------------------------------------------------

/**
 * The `line-endings` job runs the tools project narrowed to the `line-endings` filename
 * filter. Without this, every predicate above could hold over a workflow that installs
 * dependencies and does nothing.
 */
function invokesLineEndingSuite(text) {
  const jobBlock = extractJobBlock(text, 'line-endings');
  if (jobBlock === null) return false;
  const code = stripCommentLines(jobBlock);
  return /run:\s*pnpm vitest run --project tools line-endings\b/.test(code);
}

/**
 * No `--passWithNoTests`, no `continue-on-error`, no `|| true`. The first would turn
 * "the suite was renamed away" into a green run; the other two turn a real failure into one.
 */
function noEscapeHatch(text) {
  const code = stripCommentLines(text);
  return (
    !/--passWithNoTests/.test(code) &&
    !/continue-on-error:\s*true/.test(code) &&
    !/\|\|\s*true/.test(code)
  );
}

/**
 * `String.prototype.replace` that throws when the search text is absent. A mutation test
 * whose mutation silently did not apply asserts nothing — it just re-checks the real file
 * against the negated predicate and reports green for the wrong reason. Reworded a `run:`
 * step and every mutation anchored on it would go quietly vacuous without this.
 */
function mutate(text, search, replacement) {
  const mutated = text.replace(search, replacement);
  if (mutated === text) {
    throw new Error(
      `mutation did not apply — the anchor ${String(search)} is no longer in line-endings.yml, ` +
        'so this red-state case was about to pass without demonstrating anything.',
    );
  }
  return mutated;
}

const PREDICATES = {
  noPathFilter,
  unconditionalPullRequest,
  aggregatorFailsOnAnyNonSuccess,
  noSkippedTolerantAggregator,
  invokesLineEndingSuite,
  noEscapeHatch,
};

describe('line-endings.yml shape guard — the file is read from disk, not a copy', () => {
  it('the file exists — a rename fails loudly rather than silently skipping every case below', () => {
    expect(() => readFileSync(LINE_ENDINGS_YML_PATH, 'utf8')).not.toThrow();
  });
});

const realText = readFileSync(LINE_ENDINGS_YML_PATH, 'utf8');

describe('line-endings.yml shape guard — 6 predicates, each true against the real file', () => {
  for (const [name, predicate] of Object.entries(PREDICATES)) {
    it(`${name}(realText) === true`, () => {
      expect(predicate(realText)).toBe(true);
    });
  }
});

const SKIPPED_TOLERANT_IF =
  "        if: needs.line-endings.result == 'failure' || needs.line-endings.result == 'cancelled'";

describe('line-endings.yml shape guard — 11 mutations, each turning its predicate false', () => {
  it('(1) an on.push.paths list added ⇒ noPathFilter is false', () => {
    const mutated = mutate(
      realText,
      '    branches: [main, develop]',
      "    branches: [main, develop]\n    paths:\n      - 'apps/desktop/**'",
    );
    expect(noPathFilter(mutated)).toBe(false);
  });

  it('(2) a paths-ignore list added ⇒ noPathFilter is false', () => {
    const mutated = mutate(
      realText,
      '    branches: [main, develop]',
      "    branches: [main, develop]\n    paths-ignore:\n      - 'docs/**'",
    );
    expect(noPathFilter(mutated)).toBe(false);
  });

  it('(3) a dorny/paths-filter step added ⇒ noPathFilter is false', () => {
    const mutated = mutate(
      realText,
      '      - uses: actions/checkout@v4',
      '      - uses: actions/checkout@v4\n      - uses: dorny/paths-filter@v3',
    );
    expect(noPathFilter(mutated)).toBe(false);
  });

  it('(4) pull_request narrowed with paths: ⇒ unconditionalPullRequest is false', () => {
    const mutated = mutate(
      realText,
      '  pull_request:\n',
      "  pull_request:\n    paths:\n      - 'apps/desktop/**'\n",
    );
    expect(unconditionalPullRequest(mutated)).toBe(false);
  });

  it('(5) pull_request narrowed with types: ⇒ unconditionalPullRequest is false', () => {
    const mutated = mutate(
      realText,
      '  pull_request:\n',
      '  pull_request:\n    types: [labeled]\n',
    );
    expect(unconditionalPullRequest(mutated)).toBe(false);
  });

  it('(6) the pull_request trigger removed entirely ⇒ unconditionalPullRequest is false', () => {
    const mutated = mutate(realText, '  pull_request:\n', '');
    expect(unconditionalPullRequest(mutated)).toBe(false);
  });

  it("(7) the aggregator's enforcing step swapped for the ci-desktop-required idiom ⇒ aggregatorFailsOnAnyNonSuccess is false", () => {
    const mutated = mutate(
      realText,
      "        if: needs.line-endings.result != 'success'",
      SKIPPED_TOLERANT_IF,
    );
    expect(aggregatorFailsOnAnyNonSuccess(mutated)).toBe(false);
  });

  it('(8) the same swap ⇒ noSkippedTolerantAggregator is false (the skipped-tolerant shape is named, not merely absent)', () => {
    const mutated = mutate(
      realText,
      "        if: needs.line-endings.result != 'success'",
      SKIPPED_TOLERANT_IF,
    );
    expect(noSkippedTolerantAggregator(mutated)).toBe(false);
  });

  it('(9) the whole line-endings-required job deleted ⇒ both aggregator predicates are false', () => {
    const jobIndex = realText.indexOf('  line-endings-required:');
    expect(jobIndex).toBeGreaterThan(-1);
    const mutated = realText.slice(0, jobIndex);
    expect(aggregatorFailsOnAnyNonSuccess(mutated)).toBe(false);
    expect(noSkippedTolerantAggregator(mutated)).toBe(false);
  });

  it('(10) the vitest run step dropped ⇒ invokesLineEndingSuite is false', () => {
    const mutated = mutate(
      realText,
      'run: pnpm vitest run --project tools line-endings',
      'run: echo skipped',
    );
    expect(invokesLineEndingSuite(mutated)).toBe(false);
  });

  it('(11) --passWithNoTests appended to the run step ⇒ noEscapeHatch is false', () => {
    const mutated = mutate(
      realText,
      'run: pnpm vitest run --project tools line-endings',
      'run: pnpm vitest run --project tools line-endings --passWithNoTests',
    );
    expect(noEscapeHatch(mutated)).toBe(false);
  });
});
