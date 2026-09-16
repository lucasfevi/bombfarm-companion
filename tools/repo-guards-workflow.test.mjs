import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const REPO_GUARDS_YML_PATH = join(root, '.github/workflows/repo-guards.yml');

/**
 * The shape guard for `.github/workflows/repo-guards.yml`, modelled on
 * `tools/line-endings-workflow.test.mjs`. It pins the properties that workflow exists for and
 * that a well-meaning future edit would take away: it is **unconditional**, it runs the
 * **whole** tools project (no filename filter — one would silently shrink dozens of guards to
 * a single file), and its aggregator rejects `skipped` and `cancelled`, not only `failure`.
 *
 * Every predicate is a pure function over workflow *text*, asserted twice: `true` against the
 * real file on disk, and `false` against a string mutation of that same text. Deliberately
 * dumb text slicing, not a YAML parse, like the other workflow guards in this directory.
 */

function stripCommentLines(text) {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
}

function extractJobBlock(workflowText, jobName) {
  const lines = workflowText.split('\n');
  const startIndex = lines.findIndex((line) => new RegExp(`^  ${jobName}:\\s*$`).test(line));
  if (startIndex === -1) return null;

  let endIndex = lines.length;
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(lines[i])) {
      endIndex = i;
      break;
    }
  }
  return lines.slice(startIndex, endIndex).join('\n');
}

function extractSteps(jobBlock) {
  const stepsIndex = jobBlock.indexOf('\n    steps:');
  if (stepsIndex === -1) return [];
  const lines = jobBlock.slice(stepsIndex).split('\n');

  const steps = [];
  let current = [];
  for (const line of lines) {
    if (/^ {6}- (name|uses):/.test(line)) {
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

/** The job-level keys of a job block: everything indented exactly four spaces, before `steps:`. */
function jobLevelKeys(jobBlock) {
  const stepsIndex = jobBlock.indexOf('\n    steps:');
  const head = stepsIndex === -1 ? jobBlock : jobBlock.slice(0, stepsIndex);
  return head
    .split('\n')
    .map((line) => /^ {4}([A-Za-z0-9_-]+):/.exec(line))
    .filter(Boolean)
    .map((match) => match[1]);
}

function noPathFilter(text) {
  const code = stripCommentLines(text);
  return !/^\s*paths(-ignore)?:/m.test(code) && !/dorny\/paths-filter/.test(code);
}

function unconditionalPullRequest(text) {
  const lines = stripCommentLines(text).split('\n');
  const index = lines.findIndex((line) => /^ {2}pull_request:\s*$/.test(line));
  if (index === -1) return false;

  for (let i = index + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '') continue;
    return !/^ {3,}\S/.test(lines[i]);
  }
  return true;
}

/**
 * The `repo-guards` job carries no job-level `if:`. A condition there is the third spelling of
 * a path filter — `ci-web.yml` and `ci-desktop.yml` gate their jobs on
 * `needs.changes.outputs.<x> == 'true'` exactly this way.
 */
function guardJobIsUnconditional(text) {
  const jobBlock = extractJobBlock(text, 'repo-guards');
  if (jobBlock === null) return false;
  return !jobLevelKeys(stripCommentLines(jobBlock)).includes('if');
}

/**
 * The `repo-guards` job runs `pnpm vitest run --project tools` with nothing after it. A trailing
 * positional is vitest's filename filter: `line-endings.yml` uses one on purpose to run a single
 * file build-free, and the same token here would quietly turn "every guard" into "one guard".
 */
function runsWholeToolsProject(text) {
  const jobBlock = extractJobBlock(text, 'repo-guards');
  if (jobBlock === null) return false;
  const code = stripCommentLines(jobBlock);
  return /^\s*run:\s*pnpm vitest run --project tools\s*$/m.test(code);
}

function aggregatorFailsOnAnyNonSuccess(text) {
  const jobBlock = extractJobBlock(text, 'repo-guards-required');
  if (jobBlock === null) return false;
  const code = stripCommentLines(jobBlock);
  if (!/^\s*if:\s*always\(\)\s*$/m.test(code)) return false;

  return extractSteps(code).some((step) => {
    const condition = stepIf(step);
    return (
      condition !== null &&
      /needs\.repo-guards\.result\s*!=\s*'success'/.test(condition) &&
      stepFails(step)
    );
  });
}

function noSkippedTolerantAggregator(text) {
  const jobBlock = extractJobBlock(text, 'repo-guards-required');
  if (jobBlock === null) return false;
  const code = stripCommentLines(jobBlock);
  return !/needs\.repo-guards\.result\s*==\s*'(failure|cancelled|skipped)'/.test(code);
}

function noEscapeHatch(text) {
  const code = stripCommentLines(text);
  return (
    !/--passWithNoTests/.test(code) &&
    !/continue-on-error:\s*true/.test(code) &&
    !/\|\|\s*true/.test(code)
  );
}

/**
 * `String.prototype.replace` that throws when the search text is absent, so a mutation that
 * silently did not apply cannot pass its red-state case by re-checking the real file.
 */
function mutate(text, search, replacement) {
  const mutated = text.replace(search, replacement);
  if (mutated === text) {
    throw new Error(
      `mutation did not apply — the anchor ${String(search)} is no longer in repo-guards.yml, ` +
        'so this red-state case was about to pass without demonstrating anything.',
    );
  }
  return mutated;
}

const PREDICATES = {
  noPathFilter,
  unconditionalPullRequest,
  guardJobIsUnconditional,
  runsWholeToolsProject,
  aggregatorFailsOnAnyNonSuccess,
  noSkippedTolerantAggregator,
  noEscapeHatch,
};

describe('repo-guards.yml shape guard — the file is read from disk, not a copy', () => {
  it('the file exists — a rename fails loudly rather than silently skipping every case below', () => {
    expect(() => readFileSync(REPO_GUARDS_YML_PATH, 'utf8')).not.toThrow();
  });
});

const realText = readFileSync(REPO_GUARDS_YML_PATH, 'utf8');

describe('repo-guards.yml shape guard — 7 predicates, each true against the real file', () => {
  for (const [name, predicate] of Object.entries(PREDICATES)) {
    it(`${name}(realText) === true`, () => {
      expect(predicate(realText)).toBe(true);
    });
  }
});

const RUN_STEP = 'run: pnpm vitest run --project tools';
const ENFORCING_IF = "        if: needs.repo-guards.result != 'success'";
const SKIPPED_TOLERANT_IF =
  "        if: needs.repo-guards.result == 'failure' || needs.repo-guards.result == 'cancelled'";

describe('repo-guards.yml shape guard — mutations, each turning its predicate false', () => {
  it('(1) an on.push.paths list added ⇒ noPathFilter is false', () => {
    const mutated = mutate(
      realText,
      '    branches: [main, develop]',
      "    branches: [main, develop]\n    paths:\n      - 'tools/**'",
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
      "  pull_request:\n    paths:\n      - 'tools/**'\n",
    );
    expect(unconditionalPullRequest(mutated)).toBe(false);
  });

  it('(5) pull_request narrowed with branches: ⇒ unconditionalPullRequest is false', () => {
    const mutated = mutate(
      realText,
      '  pull_request:\n',
      '  pull_request:\n    branches: [develop]\n',
    );
    expect(unconditionalPullRequest(mutated)).toBe(false);
  });

  it('(6) pull_request narrowed with types: ⇒ unconditionalPullRequest is false', () => {
    const mutated = mutate(
      realText,
      '  pull_request:\n',
      '  pull_request:\n    types: [labeled]\n',
    );
    expect(unconditionalPullRequest(mutated)).toBe(false);
  });

  it('(7) the pull_request trigger removed entirely ⇒ unconditionalPullRequest is false', () => {
    const mutated = mutate(realText, '  pull_request:\n', '');
    expect(unconditionalPullRequest(mutated)).toBe(false);
  });

  it('(8) a job-level if: added to repo-guards ⇒ guardJobIsUnconditional is false', () => {
    const mutated = mutate(
      realText,
      '  repo-guards:\n',
      "  repo-guards:\n    if: github.event_name != 'pull_request'\n",
    );
    expect(guardJobIsUnconditional(mutated)).toBe(false);
  });

  it('(9) a filename filter appended to the run step ⇒ runsWholeToolsProject is false', () => {
    const mutated = mutate(realText, RUN_STEP, `${RUN_STEP} line-endings`);
    expect(runsWholeToolsProject(mutated)).toBe(false);
  });

  it('(10) the vitest run step dropped ⇒ runsWholeToolsProject is false', () => {
    const mutated = mutate(realText, RUN_STEP, 'run: echo skipped');
    expect(runsWholeToolsProject(mutated)).toBe(false);
  });

  it("(11) the aggregator's enforcing step swapped for the ci-desktop-required idiom ⇒ aggregatorFailsOnAnyNonSuccess is false", () => {
    const mutated = mutate(realText, ENFORCING_IF, SKIPPED_TOLERANT_IF);
    expect(aggregatorFailsOnAnyNonSuccess(mutated)).toBe(false);
  });

  it('(12) the same swap ⇒ noSkippedTolerantAggregator is false (the skipped-tolerant shape is named, not merely absent)', () => {
    const mutated = mutate(realText, ENFORCING_IF, SKIPPED_TOLERANT_IF);
    expect(noSkippedTolerantAggregator(mutated)).toBe(false);
  });

  it('(13) the whole repo-guards-required job deleted ⇒ both aggregator predicates are false', () => {
    const jobIndex = realText.indexOf('  repo-guards-required:');
    expect(jobIndex).toBeGreaterThan(-1);
    const mutated = realText.slice(0, jobIndex);
    expect(aggregatorFailsOnAnyNonSuccess(mutated)).toBe(false);
    expect(noSkippedTolerantAggregator(mutated)).toBe(false);
  });

  it('(14) --passWithNoTests appended to the run step ⇒ noEscapeHatch is false', () => {
    const mutated = mutate(realText, RUN_STEP, `${RUN_STEP} --passWithNoTests`);
    expect(noEscapeHatch(mutated)).toBe(false);
  });

  it('(15) continue-on-error: true added to the guard job ⇒ noEscapeHatch is false', () => {
    const mutated = mutate(
      realText,
      '    timeout-minutes: 20\n',
      '    timeout-minutes: 20\n    continue-on-error: true\n',
    );
    expect(noEscapeHatch(mutated)).toBe(false);
  });

  it('(16) `|| true` appended to the run step ⇒ noEscapeHatch is false', () => {
    const mutated = mutate(realText, RUN_STEP, `${RUN_STEP} || true`);
    expect(noEscapeHatch(mutated)).toBe(false);
  });
});
