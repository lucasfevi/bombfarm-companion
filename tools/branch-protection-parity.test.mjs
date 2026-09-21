import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Pins the required-check set to three surfaces that have drifted apart before: the
 * `-required` aggregator jobs in `.github/workflows`, the two `branch-protection-*.json`
 * files, and the list `docs/branching.md` prints. Every JSON context must resolve to a job a
 * pull request can report, every aggregator must fail on anything but `success`, and the
 * docs must list exactly what the JSON holds. Text predicates over the real files, each also
 * proven false against a mutation of that text.
 */

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const WORKFLOWS_DIR = join(root, '.github/workflows');
const PROTECTION_JSON_PATH = {
  develop: join(root, '.github/branch-protection-develop.json'),
  main: join(root, '.github/branch-protection-main.json'),
};
const BRANCHING_MD_PATH = join(root, 'docs/branching.md');

// The web e2e aggregator predates the `-required` suffix and GitHub pins its context by name.
const NON_SUFFIX_REQUIRED = ['e2e-smoke'];
// The release PR into `main` is exempt from changesets by design, so the check gates `develop` only.
const DEVELOP_ONLY = ['Require a changeset'];
const EXPECTED_FLOOR = 7;

const BOTH_BRANCHES_BULLET = '- Required status checks (both branches):';
const DEVELOP_ONLY_BULLET = '- `develop` additionally requires:';

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

function jobIds(workflowText) {
  const lines = stripCommentLines(workflowText).split('\n');
  const jobsIndex = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  if (jobsIndex === -1) return [];
  return lines
    .slice(jobsIndex + 1)
    .map((line) => line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/))
    .filter(Boolean)
    .map((match) => match[1]);
}

function jobContext(jobBlock, jobId) {
  const match = stripCommentLines(jobBlock).match(/^ {4}name:\s*(.+?)\s*$/m);
  return match ? match[1] : jobId;
}

function hasPullRequestTrigger(workflowText) {
  return /^ {2}pull_request:\s*$/m.test(stripCommentLines(workflowText));
}

function jobNeeds(jobBlock) {
  const code = stripCommentLines(jobBlock);
  const inline = code.match(/^ {4}needs:\s*\[(.*)\]\s*$/m);
  if (inline) return inline[1].split(',').map((need) => need.trim()).filter(Boolean);
  const single = code.match(/^ {4}needs:\s*([A-Za-z0-9_-]+)\s*$/m);
  if (single) return [single[1]];
  const listStart = code.match(/^ {4}needs:\s*$/m);
  if (!listStart) return [];
  const needs = [];
  for (const line of code.slice(listStart.index + listStart[0].length).split('\n').slice(1)) {
    const item = line.match(/^ {6}- ([A-Za-z0-9_-]+)\s*$/);
    if (!item) break;
    needs.push(item[1]);
  }
  return needs;
}

function isAggregator(jobBlock) {
  return jobNeeds(jobBlock).length > 0 && /^ {4}if:\s*always\(\)\s*$/m.test(stripCommentLines(jobBlock));
}

function indexJobs(workflows) {
  const entries = [];
  for (const [file, text] of workflows) {
    for (const jobId of jobIds(text)) {
      const block = extractJobBlock(text, jobId);
      entries.push({
        file,
        jobId,
        block,
        context: jobContext(block, jobId),
        onPullRequest: hasPullRequestTrigger(text),
      });
    }
  }
  return entries;
}

function requiredJobContexts(workflows) {
  return indexJobs(workflows)
    .filter((entry) => entry.jobId.endsWith('-required'))
    .map((entry) => entry.context);
}

function expectedContexts(workflows, branch) {
  return new Set([
    ...requiredJobContexts(workflows),
    ...NON_SUFFIX_REQUIRED,
    ...(branch === 'develop' ? DEVELOP_ONLY : []),
  ]);
}

function jsonContexts(jsonText) {
  return new Set(JSON.parse(jsonText).required_status_checks.checks.map((check) => check.context));
}

function difference(a, b) {
  return [...a].filter((item) => !b.has(item));
}

function censusProblems(workflows, jsonText, branch) {
  const expected = expectedContexts(workflows, branch);
  const actual = jsonContexts(jsonText);
  const problems = [];
  if (expected.size < EXPECTED_FLOOR) {
    problems.push(
      `${branch}: the workflow census found only ${expected.size} required contexts, below the floor of ${EXPECTED_FLOOR}`,
    );
  }
  for (const context of difference(expected, actual)) {
    problems.push(`${branch}: missing from branch-protection-${branch}.json: ${context}`);
  }
  for (const context of difference(actual, expected)) {
    problems.push(`${branch}: extra in branch-protection-${branch}.json (no such job): ${context}`);
  }
  return problems;
}

function unresolvedProblems(workflows, jsonText, branch) {
  const resolvable = new Set(
    indexJobs(workflows)
      .filter((entry) => entry.onPullRequest)
      .map((entry) => entry.context),
  );
  return difference(jsonContexts(jsonText), resolvable).map(
    (context) => `${branch}: no pull_request-triggered job reports the context: ${context}`,
  );
}

function enforcesNeed(steps, need) {
  const escaped = need.replace(/[-]/g, '\\-');
  const ifShape = new RegExp(
    `^(needs\\.changes\\.outputs\\.[A-Za-z0-9_-]+ == 'true' && )?needs\\.${escaped}\\.result != 'success'$`,
  );
  const shellShape = `"\${{ needs.${need}.result }}" != "success"`;
  return steps.some((step) => {
    if (!stepFails(step)) return false;
    const condition = stepIf(step);
    return (condition !== null && ifShape.test(condition)) || step.includes(shellShape);
  });
}

function toleratesNeed(steps, need) {
  const shape = new RegExp(`needs\\.${need}\\.result\\s*==\\s*'(failure|cancelled|skipped)'`);
  return steps.some((step) => {
    const condition = stepIf(step);
    return condition !== null && shape.test(condition);
  });
}

function idiomProblems(workflows, jsonText, branch) {
  const problems = [];
  const entries = indexJobs(workflows);
  for (const context of jsonContexts(jsonText)) {
    const entry = entries.find((candidate) => candidate.context === context);
    if (!entry) continue;
    const code = stripCommentLines(entry.block);
    if (!isAggregator(entry.block)) {
      if (/continue-on-error:\s*true/.test(code)) {
        problems.push(`${branch}: ${context} carries continue-on-error: true`);
      }
      continue;
    }
    const steps = extractSteps(code);
    for (const need of jobNeeds(entry.block)) {
      if (need !== 'changes' && !enforcesNeed(steps, need)) {
        problems.push(`${branch}: ${context} → ${need}: no step fails on result != 'success'`);
      }
      if (toleratesNeed(steps, need)) {
        problems.push(`${branch}: ${context} → ${need}: a step tests result == failure/cancelled/skipped`);
      }
    }
  }
  return problems;
}

function bulletContexts(docsText, bulletPrefix) {
  const line = docsText.split('\n').find((candidate) => candidate.startsWith(bulletPrefix));
  if (line === undefined) return null;
  const list = line.slice(bulletPrefix.length).split(' — ')[0];
  return new Set([...list.matchAll(/`([^`]+)`/g)].map((match) => match[1]));
}

function docsProblems(docsText, developJsonText, mainJsonText) {
  const problems = [];
  const both = bulletContexts(docsText, BOTH_BRANCHES_BULLET);
  if (both === null) return [`docs/branching.md: bullet "${BOTH_BRANCHES_BULLET}" is missing`];
  const main = jsonContexts(mainJsonText);
  const develop = jsonContexts(developJsonText);
  for (const context of difference(main, both)) {
    problems.push(`docs/branching.md: both-branches bullet omits ${context}`);
  }
  for (const context of difference(both, main)) {
    problems.push(`docs/branching.md: both-branches bullet lists ${context}, which main does not require`);
  }

  const developOnly = new Set(difference(develop, main));
  const extra = bulletContexts(docsText, DEVELOP_ONLY_BULLET);
  if (extra === null) {
    if (developOnly.size > 0) {
      problems.push(
        `docs/branching.md: bullet "${DEVELOP_ONLY_BULLET}" is missing but develop requires ${[...developOnly].join(', ')}`,
      );
    }
    return problems;
  }
  for (const context of difference(developOnly, extra)) {
    problems.push(`docs/branching.md: develop-only bullet omits ${context}`);
  }
  for (const context of difference(extra, developOnly)) {
    problems.push(`docs/branching.md: develop-only bullet lists ${context}, which is not develop-only`);
  }
  return problems;
}

function mutate(text, search, replacement) {
  const mutated = text.replace(search, replacement);
  if (mutated === text) {
    throw new Error(
      `mutation did not apply — the anchor ${String(search)} is absent, ` +
        'so this red-state case was about to pass without demonstrating anything.',
    );
  }
  return mutated;
}

function mutateWorkflow(workflows, file, search, replacement) {
  if (!workflows.has(file)) throw new Error(`no workflow named ${file}`);
  const mutated = new Map(workflows);
  mutated.set(file, mutate(workflows.get(file), search, replacement));
  return mutated;
}

function readWorkflows() {
  return new Map(
    readdirSync(WORKFLOWS_DIR)
      .filter((file) => file.endsWith('.yml'))
      .map((file) => [file, readFileSync(join(WORKFLOWS_DIR, file), 'utf8')]),
  );
}

const workflows = readWorkflows();
const json = {
  develop: readFileSync(PROTECTION_JSON_PATH.develop, 'utf8'),
  main: readFileSync(PROTECTION_JSON_PATH.main, 'utf8'),
};
const docsText = readFileSync(BRANCHING_MD_PATH, 'utf8');

describe('branch protection parity — the real files agree', () => {
  for (const branch of ['develop', 'main']) {
    it(`(a) ${branch}: every -required job, e2e-smoke and the develop-only checks are exactly the JSON set`, () => {
      expect(censusProblems(workflows, json[branch], branch)).toEqual([]);
    });

    it(`(b) ${branch}: every JSON context is reported by a job in a pull_request-triggered workflow`, () => {
      expect(unresolvedProblems(workflows, json[branch], branch)).toEqual([]);
    });

    it(`(c) ${branch}: every aggregator context fails on any non-success of each need`, () => {
      expect(idiomProblems(workflows, json[branch], branch)).toEqual([]);
    });
  }

  it('(d) docs/branching.md lists the main set and the develop-only set exactly', () => {
    expect(docsProblems(docsText, json.develop, json.main)).toEqual([]);
  });

  it('the -required census resolves through name:, not only the job id', () => {
    const renamed = mutateWorkflow(
      workflows,
      'line-endings.yml',
      '    name: line-endings-required',
      '    name: LF policy gate',
    );
    expect(requiredJobContexts(renamed)).toContain('LF policy gate');
    expect(requiredJobContexts(renamed)).not.toContain('line-endings-required');
  });
});

describe('branch protection parity — each predicate turns red under a mutation', () => {
  it('(a) a context removed from the JSON is named as missing', () => {
    const mutated = mutate(json.develop, '      { "context": "line-endings-required" },\n', '');
    expect(censusProblems(workflows, mutated, 'develop')).toEqual([
      'develop: missing from branch-protection-develop.json: line-endings-required',
    ]);
  });

  const withImaginary = mutate(
    json.main,
    '      { "context": "e2e-smoke" },',
    '      { "context": "e2e-smoke" },\n      { "context": "imaginary-required" },',
  );

  it('(a) a context added to the JSON with no job behind it is named as extra', () => {
    expect(censusProblems(workflows, withImaginary, 'main')).toEqual([
      'main: extra in branch-protection-main.json (no such job): imaginary-required',
    ]);
  });

  it('(b) the same context is named as unresolved', () => {
    expect(unresolvedProblems(workflows, withImaginary, 'main')).toEqual([
      'main: no pull_request-triggered job reports the context: imaginary-required',
    ]);
  });

  it('(a) a -required job renamed in its workflow leaves the JSON context extra', () => {
    const renamed = mutateWorkflow(
      workflows,
      'line-endings.yml',
      '  line-endings-required:\n',
      '  line-endings-gate:\n',
    );
    expect(censusProblems(renamed, json.develop, 'develop')).toEqual([
      'develop: extra in branch-protection-develop.json (no such job): line-endings-required',
    ]);
  });

  it("(c) an aggregator step swapped for == 'failure' || == 'cancelled' names context → need", () => {
    const swapped = mutateWorkflow(
      workflows,
      'repo-guards.yml',
      "        if: needs.repo-guards.result != 'success'",
      "        if: needs.repo-guards.result == 'failure' || needs.repo-guards.result == 'cancelled'",
    );
    expect(idiomProblems(swapped, json.develop, 'develop')).toEqual([
      "develop: repo-guards-required → repo-guards: no step fails on result != 'success'",
      'develop: repo-guards-required → repo-guards: a step tests result == failure/cancelled/skipped',
    ]);
  });

  it("(c) a step tolerating result == 'skipped' is named even beside the enforcing step", () => {
    const tolerant = mutateWorkflow(
      workflows,
      'repo-guards.yml',
      "        if: needs.repo-guards.result != 'success'",
      "        if: needs.repo-guards.result == 'skipped'\n        run: echo ok\n\n      - name: Enforce\n        if: needs.repo-guards.result != 'success'",
    );
    expect(idiomProblems(tolerant, json.develop, 'develop')).toEqual([
      'develop: repo-guards-required → repo-guards: a step tests result == failure/cancelled/skipped',
    ]);
  });

  it('(c) a non-aggregator context with continue-on-error: true is named', () => {
    const softened = mutateWorkflow(
      workflows,
      'changesets.yml',
      '    name: Require a changeset\n',
      '    name: Require a changeset\n    continue-on-error: true\n',
    );
    expect(idiomProblems(softened, json.develop, 'develop')).toEqual([
      'develop: Require a changeset carries continue-on-error: true',
    ]);
  });

  it('(d) a context deleted from the both-branches bullet is named', () => {
    const mutated = mutate(docsText, '`fidelity-gate-required`, ', '');
    expect(docsProblems(mutated, json.develop, json.main)).toEqual([
      'docs/branching.md: both-branches bullet omits fidelity-gate-required',
    ]);
  });

  it('(d) the develop-only bullet deleted fails while develop and main differ', () => {
    const line = docsText.split('\n').find((candidate) => candidate.startsWith(DEVELOP_ONLY_BULLET));
    const mutated = mutate(docsText, `${line}\n`, '');
    expect(docsProblems(mutated, json.develop, json.main)).toEqual([
      'docs/branching.md: bullet "- `develop` additionally requires:" is missing but develop requires Require a changeset',
    ]);
  });

  it('(a) the floor: a census that finds fewer than 7 contexts fails even when the JSON matches it', () => {
    const stripped = new Map(
      [...workflows].map(([file, text]) => [file, text.replace(/^ {2}([a-z-]+)-required:\s*$/gm, '  $1-gate:')]),
    );
    expect(requiredJobContexts(stripped)).toEqual([]);
    const shrunkJson = JSON.stringify({
      required_status_checks: { checks: [...expectedContexts(stripped, 'develop')].map((context) => ({ context })) },
    });
    expect(censusProblems(stripped, shrunkJson, 'develop')).toEqual([
      `develop: the workflow census found only 2 required contexts, below the floor of ${EXPECTED_FLOOR}`,
    ]);
  });
});
