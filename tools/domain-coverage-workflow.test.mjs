import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CI_WEB_PATH = join(root, '.github/workflows/ci-web.yml');
const JOB = 'domain-coverage';
const AGGREGATOR = 'ci-web-required';

/**
 * The shape guard for the `domain-coverage` job in `ci-web.yml`, modelled on
 * `tools/repo-guards-workflow.test.mjs`. The ratchet is only a ratchet while the job that runs
 * it can neither be skipped, nor made advisory, nor starved of its inputs: it has to run the
 * check with no escape hatch, compare against the base branch on pull requests, be a need of
 * the aggregator that branch protection reads, and be triggered by every path that can move the
 * numbers. Every predicate is a pure function over workflow text, asserted `true` against the
 * real file and `false` against a mutation of it.
 */

const REQUIRED_FILTER_ENTRIES = [
  'packages/domain/**',
  'packages/contracts/**',
  'vitest.config.ts',
  'vitest.solver.config.ts',
  'vitest.solver-files.mjs',
  'vitest.coverage.ts',
  'vitest.workers.ts',
  'tools/domain-coverage*.mjs',
  'tools/cpu-budget.mjs',
  'tools/with-heavy-slot.mjs',
  'tools/shell-command.mjs',
  'pnpm-lock.yaml',
];

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
  const steps = [];
  let current = [];
  for (const line of jobBlock.slice(stepsIndex).split('\n')) {
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

function stepRun(stepText) {
  return /^\s*run:/m.test(stepText) ? stepText.slice(stepText.search(/^\s*run:/m)) : '';
}

function stepFails(stepText) {
  return /\bexit\s+1\b/.test(stepText);
}

function jobLevelValue(jobBlock, key) {
  const stepsIndex = jobBlock.indexOf('\n    steps:');
  const head = stepsIndex === -1 ? jobBlock : jobBlock.slice(0, stepsIndex);
  const match = head.match(new RegExp(`^ {4}${key}:\\s*(.+?)\\s*$`, 'm'));
  return match ? match[1] : null;
}

function quotedItems(lines, startIndex) {
  const items = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const match = lines[i].match(/^\s*-\s*'([^']+)'\s*$/);
    if (!match) break;
    items.push(match[1]);
  }
  return items;
}

function filterList(text, name) {
  const lines = text.split('\n');
  const filtersIndex = lines.findIndex((line) => /^\s*filters:\s*\|\s*$/.test(line));
  if (filtersIndex === -1) return null;
  const nameIndex = lines.findIndex((line, index) => index > filtersIndex && line.trim() === `${name}:`);
  return nameIndex === -1 ? null : quotedItems(lines, nameIndex);
}

function pushPaths(text) {
  const lines = text.split('\n');
  const pathsIndex = lines.findIndex((line) => /^ {4}paths:\s*$/.test(line));
  return pathsIndex === -1 ? null : quotedItems(lines, pathsIndex);
}

function coverageJob(text) {
  const block = extractJobBlock(text, JOB);
  return block === null ? null : stripCommentLines(block);
}

function coverageJobExists(text) {
  return coverageJob(text) !== null && /^ {4}name:\s*Domain coverage ratchet\s*$/m.test(coverageJob(text));
}

function jobGatedOnDomainFilter(text) {
  const block = coverageJob(text);
  if (block === null) return false;
  return (
    jobLevelValue(block, 'if') === "github.event_name != 'pull_request' || needs.changes.outputs.domain == 'true'" &&
    jobLevelValue(block, 'needs') === 'changes'
  );
}

function changesJobExportsDomainFilter(text) {
  const block = extractJobBlock(stripCommentLines(text), 'changes');
  return block !== null && /^ {6}domain:\s*\$\{\{\s*steps\.filter\.outputs\.domain\s*\}\}\s*$/m.test(block);
}

function checkStepIsUnconditionalAndStrict(text) {
  const block = coverageJob(text);
  if (block === null) return false;
  const checkStep = extractSteps(block).find((step) => /^\s*run:\s*pnpm coverage:domain\s*$/m.test(step));
  return checkStep !== undefined && stepIf(checkStep) === null && !/continue-on-error/.test(checkStep) && !/\|\|/.test(stepRun(checkStep));
}

function noEscapeHatchInJob(text) {
  const block = coverageJob(text);
  if (block === null) return false;
  return !/continue-on-error/.test(block) && !/\|\|\s*true/.test(block) && !/--passWithNoTests/.test(block);
}

function buildPrecedesMeasurement(text) {
  const block = coverageJob(text);
  if (block === null) return false;
  const steps = extractSteps(block);
  const build = steps.findIndex((step) => /pnpm --filter @bombfarm\/contracts --filter @bombfarm\/domain build/.test(step));
  const measure = steps.findIndex((step) => /^\s*run:\s*pnpm coverage:domain\s*$/m.test(step));
  return build !== -1 && measure !== -1 && build < measure;
}

function guardsAgainstBaseBranchOnPullRequests(text) {
  const block = coverageJob(text);
  if (block === null) return false;
  const step = extractSteps(block).find((candidate) => /domain-coverage\.mjs guard-base --base "origin\/\$BASE_REF"/.test(candidate));
  if (step === undefined) return false;
  const condition = stepIf(step);
  return (
    condition !== null &&
    condition.includes("github.event_name == 'pull_request'") &&
    /git fetch --no-tags --depth=1 origin "\+refs\/heads\/\$BASE_REF:refs\/remotes\/origin\/\$BASE_REF"/.test(step) &&
    /BASE_REF:\s*\$\{\{\s*github\.base_ref\s*\}\}/.test(step) &&
    !/continue-on-error/.test(step)
  );
}

function uploadsReportEvenOnFailure(text) {
  const block = coverageJob(text);
  if (block === null) return false;
  const step = extractSteps(block).find((candidate) => /uses:\s*actions\/upload-artifact@/.test(candidate));
  return (
    step !== undefined &&
    stepIf(step) === 'always()' &&
    /name:\s*domain-coverage\s*$/m.test(step) &&
    /path:\s*coverage\s*$/m.test(step) &&
    /retention-days:\s*7\s*$/m.test(step)
  );
}

function jobTimeoutLeavesRoomForTheInstrumentedRun(text) {
  const block = coverageJob(text);
  if (block === null) return false;
  return Number(jobLevelValue(block, 'timeout-minutes')) >= 50;
}

function aggregatorNeedsCoverageJob(text) {
  const block = extractJobBlock(stripCommentLines(text), AGGREGATOR);
  if (block === null) return false;
  const match = block.match(/^ {4}needs:\s*\[(.*)\]\s*$/m);
  return match !== null && match[1].split(',').map((need) => need.trim()).includes(JOB);
}

function aggregatorFailsOnAnyNonSuccess(text) {
  const block = extractJobBlock(stripCommentLines(text), AGGREGATOR);
  if (block === null) return false;
  if (!/^ {4}if:\s*always\(\)\s*$/m.test(block)) return false;
  return extractSteps(block).some(
    (step) =>
      stepIf(step) === `needs.changes.outputs.domain == 'true' && needs.${JOB}.result != 'success'` && stepFails(step),
  );
}

function aggregatorToleratesNothing(text) {
  const block = extractJobBlock(stripCommentLines(text), AGGREGATOR);
  if (block === null) return false;
  return !new RegExp(`needs\\.${JOB}\\.result\\s*==\\s*'(failure|cancelled|skipped)'`).test(block);
}

function domainFilterHasEveryRequiredPath(text) {
  const list = filterList(text, 'domain');
  return list !== null && REQUIRED_FILTER_ENTRIES.every((entry) => list.includes(entry));
}

function pushPathsCoverTheDomainFilter(text) {
  const list = filterList(text, 'domain');
  const pushed = pushPaths(text);
  return list !== null && pushed !== null && list.every((entry) => pushed.includes(entry));
}

function pullRequestTriggerIsUnfiltered(text) {
  const lines = stripCommentLines(text).split('\n');
  const index = lines.findIndex((line) => /^ {2}pull_request:\s*$/.test(line));
  if (index === -1) return false;
  const next = lines.slice(index + 1).find((line) => line.trim() !== '');
  return next === undefined || !/^ {3,}\S/.test(next);
}

function missingFilterEntries(text) {
  const list = filterList(text, 'domain') ?? [];
  return REQUIRED_FILTER_ENTRIES.filter((entry) => !list.includes(entry));
}

function globToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('**', '\u0000').replaceAll('*', '[^/]*').replaceAll('\u0000', '.*');
  return new RegExp(`^${escaped}$`);
}

function matchedByFilter(text, file) {
  return (filterList(text, 'domain') ?? []).some((pattern) => globToRegExp(pattern).test(file));
}

function relativeImportsOf(source) {
  return [...source.matchAll(/from\s+'(\.[^']+)'/g)].map((match) => match[1]);
}

function toolImportClosure(entryFiles) {
  const seen = new Set();
  const pending = [...entryFiles];
  while (pending.length > 0) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(join(root, file), 'utf8');
    for (const specifier of relativeImportsOf(source)) {
      pending.push(join(dirname(file), specifier).replaceAll('\\', '/'));
    }
  }
  return [...seen].sort();
}

function mutate(text, search, replacement) {
  const mutated = text.replace(search, replacement);
  if (mutated === text) {
    throw new Error(`mutation did not apply — the anchor ${String(search)} is no longer in ci-web.yml, so this red-state case proved nothing.`);
  }
  return mutated;
}

const PREDICATES = {
  coverageJobExists,
  jobGatedOnDomainFilter,
  changesJobExportsDomainFilter,
  checkStepIsUnconditionalAndStrict,
  noEscapeHatchInJob,
  buildPrecedesMeasurement,
  guardsAgainstBaseBranchOnPullRequests,
  uploadsReportEvenOnFailure,
  jobTimeoutLeavesRoomForTheInstrumentedRun,
  aggregatorNeedsCoverageJob,
  aggregatorFailsOnAnyNonSuccess,
  aggregatorToleratesNothing,
  domainFilterHasEveryRequiredPath,
  pushPathsCoverTheDomainFilter,
  pullRequestTriggerIsUnfiltered,
};

const realText = readFileSync(CI_WEB_PATH, 'utf8');

describe('ci-web.yml domain-coverage shape guard — each predicate is true against the real file', () => {
  it('the file exists and carries the job', () => {
    expect(realText).toContain(`\n  ${JOB}:\n`);
  });

  for (const [name, predicate] of Object.entries(PREDICATES)) {
    it(`${name}(realText) === true`, () => {
      expect(predicate(realText)).toBe(true);
    });
  }

  it('the domain filter lists no required path as missing', () => {
    expect(missingFilterEntries(realText)).toEqual([]);
  });

  it('the filter matches every tool file the coverage CLI transitively imports', () => {
    const closure = toolImportClosure(['tools/domain-coverage.mjs', 'tools/domain-coverage-core.mjs']);
    expect(closure).toContain('tools/cpu-budget.mjs');
    const unmatched = closure.filter((file) => !matchedByFilter(realText, file));
    expect(unmatched, `imported by the coverage tools but not matched by the domain filter: ${unmatched.join(', ')}`).toEqual([]);
  });
});

const JOB_IF = "    if: github.event_name != 'pull_request' || needs.changes.outputs.domain == 'true'\n    runs-on: ubuntu-latest\n    timeout-minutes: 50";
const CHECK_STEP = 'run: pnpm coverage:domain\n';
const ENFORCING_IF = "        if: needs.changes.outputs.domain == 'true' && needs.domain-coverage.result != 'success'";
const TOLERANT_IF = "        if: needs.domain-coverage.result == 'failure' || needs.domain-coverage.result == 'cancelled'";
const GUARD_RUN = 'node tools/domain-coverage.mjs guard-base --base "origin/$BASE_REF"';

describe('ci-web.yml domain-coverage shape guard — mutations, each turning its predicate false', () => {
  it('(1) the job renamed ⇒ coverageJobExists is false', () => {
    expect(coverageJobExists(mutate(realText, '\n  domain-coverage:\n', '\n  domain-coverage-renamed:\n'))).toBe(false);
  });

  it('(2) the job deleted entirely ⇒ every job-level predicate is false', () => {
    const start = realText.indexOf('  domain-coverage:\n');
    const end = realText.indexOf('  design-system:\n');
    const mutated = realText.slice(0, start) + realText.slice(end);
    for (const name of ['coverageJobExists', 'jobGatedOnDomainFilter', 'checkStepIsUnconditionalAndStrict', 'noEscapeHatchInJob', 'buildPrecedesMeasurement', 'guardsAgainstBaseBranchOnPullRequests', 'uploadsReportEvenOnFailure']) {
      expect(PREDICATES[name](mutated), name).toBe(false);
    }
  });

  it('(3) the job gated on the web filter instead ⇒ jobGatedOnDomainFilter is false', () => {
    expect(jobGatedOnDomainFilter(mutate(realText, JOB_IF, JOB_IF.replace('outputs.domain', 'outputs.web')))).toBe(false);
  });

  it('(4) the job-level if dropped ⇒ jobGatedOnDomainFilter is false', () => {
    expect(jobGatedOnDomainFilter(mutate(realText, JOB_IF.split('\n')[0] + '\n', ''))).toBe(false);
  });

  it('(5) the changes job no longer exports the domain output ⇒ changesJobExportsDomainFilter is false', () => {
    expect(changesJobExportsDomainFilter(mutate(realText, '      domain: ${{ steps.filter.outputs.domain }}\n', ''))).toBe(false);
  });

  it('(6) continue-on-error on the check step ⇒ checkStepIsUnconditionalAndStrict and noEscapeHatchInJob are false', () => {
    const mutated = mutate(realText, `        ${CHECK_STEP}`, `        ${CHECK_STEP}        continue-on-error: true\n`);
    expect(checkStepIsUnconditionalAndStrict(mutated)).toBe(false);
    expect(noEscapeHatchInJob(mutated)).toBe(false);
  });

  it('(7) `|| true` after the check ⇒ checkStepIsUnconditionalAndStrict is false', () => {
    expect(checkStepIsUnconditionalAndStrict(mutate(realText, 'run: pnpm coverage:domain\n', 'run: pnpm coverage:domain || true\n'))).toBe(false);
  });

  it('(8) the check step made conditional ⇒ checkStepIsUnconditionalAndStrict is false', () => {
    const mutated = mutate(
      realText,
      '      - name: Measure both passes and compare with the committed baseline\n',
      "      - name: Measure both passes and compare with the committed baseline\n        if: github.event_name == 'push'\n",
    );
    expect(checkStepIsUnconditionalAndStrict(mutated)).toBe(false);
  });

  it('(9) the check step replaced by an echo ⇒ checkStepIsUnconditionalAndStrict is false', () => {
    expect(checkStepIsUnconditionalAndStrict(mutate(realText, 'run: pnpm coverage:domain\n', 'run: echo skipped\n'))).toBe(false);
  });

  it('(10) the build step removed ⇒ buildPrecedesMeasurement is false', () => {
    const mutated = mutate(realText, 'run: pnpm --filter @bombfarm/contracts --filter @bombfarm/domain build\n\n      - name: Measure', 'run: echo no build\n\n      - name: Measure');
    expect(buildPrecedesMeasurement(mutated)).toBe(false);
  });

  it('(11) the guard-base step removed ⇒ guardsAgainstBaseBranchOnPullRequests is false', () => {
    expect(guardsAgainstBaseBranchOnPullRequests(mutate(realText, GUARD_RUN, 'echo skipped'))).toBe(false);
  });

  it('(12) the guard-base step limited to pushes ⇒ guardsAgainstBaseBranchOnPullRequests is false', () => {
    const mutated = mutate(realText, "if: github.event_name == 'pull_request' && !cancelled()", "if: github.event_name == 'push'");
    expect(guardsAgainstBaseBranchOnPullRequests(mutated)).toBe(false);
  });

  it('(13) the base-branch fetch removed ⇒ guardsAgainstBaseBranchOnPullRequests is false', () => {
    const mutated = mutate(realText, 'git fetch --no-tags --depth=1', 'echo no fetch');
    expect(guardsAgainstBaseBranchOnPullRequests(mutated)).toBe(false);
  });

  it('(14) the guard-base step made advisory ⇒ guardsAgainstBaseBranchOnPullRequests and noEscapeHatchInJob are false', () => {
    const mutated = mutate(realText, '        env:\n          BASE_REF', '        continue-on-error: true\n        env:\n          BASE_REF');
    expect(guardsAgainstBaseBranchOnPullRequests(mutated)).toBe(false);
    expect(noEscapeHatchInJob(mutated)).toBe(false);
  });

  it('(15a) the artifact narrowed back to the merged report only, or its retention dropped ⇒ uploadsReportEvenOnFailure is false', () => {
    expect(uploadsReportEvenOnFailure(mutate(realText, '          path: coverage\n', '          path: coverage/domain\n'))).toBe(false);
    expect(uploadsReportEvenOnFailure(mutate(realText, '          retention-days: 7\n', ''))).toBe(false);
  });

  it('(15b) the job timeout cut back to 40 minutes ⇒ jobTimeoutLeavesRoomForTheInstrumentedRun is false', () => {
    expect(jobTimeoutLeavesRoomForTheInstrumentedRun(mutate(realText, 'timeout-minutes: 50', 'timeout-minutes: 40'))).toBe(false);
  });

  it('(15) the artifact upload no longer runs on failure ⇒ uploadsReportEvenOnFailure is false', () => {
    expect(uploadsReportEvenOnFailure(mutate(realText, "if: always()\n        uses: actions/upload-artifact@", 'uses: actions/upload-artifact@'))).toBe(false);
  });

  it('(16) the job dropped from the aggregator needs ⇒ aggregatorNeedsCoverageJob is false', () => {
    expect(aggregatorNeedsCoverageJob(mutate(realText, 'needs: [changes, quality, domain, domain-coverage]', 'needs: [changes, quality, domain]'))).toBe(false);
  });

  it('(17) the aggregator step swapped for the skipped-tolerant idiom ⇒ aggregatorFailsOnAnyNonSuccess and aggregatorToleratesNothing are false', () => {
    const mutated = mutate(realText, ENFORCING_IF, TOLERANT_IF);
    expect(aggregatorFailsOnAnyNonSuccess(mutated)).toBe(false);
    expect(aggregatorToleratesNothing(mutated)).toBe(false);
  });

  it('(18) the aggregator step gated on the web filter ⇒ aggregatorFailsOnAnyNonSuccess is false', () => {
    const mutated = mutate(realText, ENFORCING_IF, ENFORCING_IF.replace('outputs.domain', 'outputs.web'));
    expect(aggregatorFailsOnAnyNonSuccess(mutated)).toBe(false);
  });

  it('(19) the aggregator step that never fails ⇒ aggregatorFailsOnAnyNonSuccess is false', () => {
    const mutated = mutate(realText, '          echo "domain-coverage: ${{ needs.domain-coverage.result }}"\n          exit 1', '          echo "domain-coverage: ${{ needs.domain-coverage.result }}"');
    expect(aggregatorFailsOnAnyNonSuccess(mutated)).toBe(false);
  });

  it('(20) each required entry removed from the domain filter in turn ⇒ domainFilterHasEveryRequiredPath is false and names it', () => {
    const lines = realText.split('\n');
    const filterStart = lines.findIndex((line) => line.trim() === 'domain:' && line.startsWith('            '));
    expect(filterStart).toBeGreaterThan(-1);
    for (const entry of REQUIRED_FILTER_ENTRIES) {
      const target = lines.findIndex((line, index) => index > filterStart && line.trim() === `- '${entry}'`);
      expect(target, entry).toBeGreaterThan(filterStart);
      const mutated = lines.filter((_, index) => index !== target).join('\n');
      expect(domainFilterHasEveryRequiredPath(mutated), entry).toBe(false);
      expect(missingFilterEntries(mutated), entry).toEqual([entry]);
    }
  });

  it('(21) the domain filter dropped entirely ⇒ domainFilterHasEveryRequiredPath is false', () => {
    const mutated = realText.replace(/^ {12}domain:\n(?: {14}- '[^']+'\n)+/m, '');
    expect(mutated).not.toBe(realText);
    expect(domainFilterHasEveryRequiredPath(mutated)).toBe(false);
  });

  it('(22) a path added to the filter and not to on.push.paths ⇒ pushPathsCoverTheDomainFilter is false', () => {
    const mutated = mutate(realText, "              - 'tools/shell-command.mjs'\n              - 'pnpm-lock.yaml'", "              - 'tools/shell-command.mjs'\n              - 'tools/new-thing.mjs'\n              - 'pnpm-lock.yaml'");
    expect(pushPathsCoverTheDomainFilter(mutated)).toBe(false);
  });

  it('(23) on.push.paths losing the coverage tools ⇒ pushPathsCoverTheDomainFilter is false', () => {
    const mutated = mutate(realText, "      - 'tools/domain-coverage*.mjs'\n", '');
    expect(pushPathsCoverTheDomainFilter(mutated)).toBe(false);
  });

  it('(24) pull_request narrowed with types: ⇒ pullRequestTriggerIsUnfiltered is false', () => {
    expect(pullRequestTriggerIsUnfiltered(mutate(realText, '  pull_request:\n', '  pull_request:\n    types: [labeled]\n'))).toBe(false);
  });

  it('(25) an imported tool file missing from the filter is caught by the closure check', () => {
    const mutated = mutate(realText, "              - 'tools/cpu-budget.mjs'\n              - 'tools/with-heavy-slot.mjs'", "              - 'tools/with-heavy-slot.mjs'");
    const closure = toolImportClosure(['tools/domain-coverage.mjs', 'tools/domain-coverage-core.mjs']);
    expect(closure.filter((file) => !matchedByFilter(mutated, file))).toEqual(['tools/cpu-budget.mjs']);
  });
});

const CLI_PATH = join(root, 'tools/domain-coverage.mjs');
const cliText = readFileSync(CLI_PATH, 'utf8');

function measurementCommands(source) {
  return [...source.matchAll(/'(pnpm exec vitest run [^']+)'/g)].map((match) => match[1]);
}

function commandsOf(source) {
  const commands = measurementCommands(source);
  return {
    main: commands.find((command) => command.includes('--project @bombfarm/domain')),
    solver: commands.find((command) => command.includes('--config vitest.solver.config.ts')),
    merge: commands.find((command) => command.includes('--merge-reports=coverage/domain-blobs')),
  };
}

function measuringPassesAreTolerantAndNamed(source) {
  const { main, solver } = commandsOf(source);
  if (main === undefined || solver === undefined) return false;
  return [
    ['main', main],
    ['solver', solver],
  ].every(
    ([name, command]) =>
      command.includes('--coverage ') &&
      command.includes('--dangerouslyIgnoreUnhandledErrors') &&
      command.includes('--testTimeout=600000') &&
      command.includes('--reporter=blob') &&
      command.includes('--reporter=dot') &&
      command.includes(`--outputFile.blob=coverage/domain-blobs/${name}.json`) &&
      !/--outputFile=/.test(command),
  );
}

function mergeReplaysUnhandledErrors(source) {
  const { merge } = commandsOf(source);
  return merge !== undefined && merge.includes('--dangerouslyIgnoreUnhandledErrors') && merge.includes('--coverage ');
}

function nothingSwitchesTheUntestedFileSweepOff(source) {
  const { main, solver, merge } = commandsOf(source);
  return [main, solver, merge].every((command) => command !== undefined && !command.includes('--coverage.all=false'));
}

function nonZeroPassPointsAtTheOutput(source) {
  return /exited \$\{code\}\. The cause is in the vitest output above/.test(source);
}

describe('tools/domain-coverage.mjs measures both Vitest passes and merges them', () => {
  it('both measuring passes are tolerant, long-timeout, blob-plus-dot instrumented runs writing their blob', () => {
    expect(measuringPassesAreTolerantAndNamed(cliText)).toBe(true);
  });

  it('the merge replays the solver pass with unhandled errors ignored', () => {
    expect(mergeReplaysUnhandledErrors(cliText)).toBe(true);
  });

  it('nothing passes --coverage.all=false: the sweep it disables is what puts never-loaded files in the report', () => {
    expect(nothingSwitchesTheUntestedFileSweepOff(cliText)).toBe(true);
  });

  it('a failing pass prints a line pointing at the output above', () => {
    expect(nonZeroPassPointsAtTheOutput(cliText)).toBe(true);
  });

  describe.each([
    ['--project @bombfarm/domain', 'main'],
    ['--config vitest.solver.config.ts', 'solver'],
  ])('mutations of the %s pass', (selector, name) => {
    it('losing --dangerouslyIgnoreUnhandledErrors turns the predicate false', () => {
      const mutated = mutate(cliText, `${selector} --dangerouslyIgnoreUnhandledErrors`, selector);
      expect(measuringPassesAreTolerantAndNamed(mutated)).toBe(false);
    });

    it('losing --testTimeout=600000 turns the predicate false', () => {
      const mutated = mutate(cliText, `${selector} --dangerouslyIgnoreUnhandledErrors --testTimeout=600000`, `${selector} --dangerouslyIgnoreUnhandledErrors`);
      expect(measuringPassesAreTolerantAndNamed(mutated)).toBe(false);
    });

    it('losing --reporter=dot turns the predicate false', () => {
      const mutated = mutate(cliText, `--reporter=blob --reporter=dot --outputFile.blob=coverage/domain-blobs/${name}.json`, `--reporter=blob --outputFile.blob=coverage/domain-blobs/${name}.json`);
      expect(measuringPassesAreTolerantAndNamed(mutated)).toBe(false);
    });

    it('the single-reporter output syntax turns the predicate false', () => {
      const mutated = mutate(cliText, `--outputFile.blob=coverage/domain-blobs/${name}.json`, `--outputFile=coverage/domain-blobs/${name}.json`);
      expect(measuringPassesAreTolerantAndNamed(mutated)).toBe(false);
    });

    it('adding --coverage.all=false turns nothingSwitchesTheUntestedFileSweepOff false', () => {
      const mutated = mutate(cliText, `${selector} --dangerouslyIgnoreUnhandledErrors`, `${selector} --coverage.all=false --dangerouslyIgnoreUnhandledErrors`);
      expect(nothingSwitchesTheUntestedFileSweepOff(mutated)).toBe(false);
    });
  });

  it('the merge losing --dangerouslyIgnoreUnhandledErrors turns mergeReplaysUnhandledErrors false', () => {
    const mutated = mutate(cliText, '--merge-reports=coverage/domain-blobs --dangerouslyIgnoreUnhandledErrors', '--merge-reports=coverage/domain-blobs');
    expect(mergeReplaysUnhandledErrors(mutated)).toBe(false);
  });

  it('adding --coverage.all=false to the merge turns nothingSwitchesTheUntestedFileSweepOff false', () => {
    const mutated = mutate(cliText, '--dangerouslyIgnoreUnhandledErrors --coverage --coverage.reportsDirectory=coverage/domain ', '--dangerouslyIgnoreUnhandledErrors --coverage --coverage.all=false --coverage.reportsDirectory=coverage/domain ');
    expect(nothingSwitchesTheUntestedFileSweepOff(mutated)).toBe(false);
  });

  it('dropping the solver pass turns the pass predicate false', () => {
    expect(measuringPassesAreTolerantAndNamed(mutate(cliText, '--config vitest.solver.config.ts', '--config vitest.other.config.ts'))).toBe(false);
  });

  it('losing the failure pointer turns nonZeroPassPointsAtTheOutput false', () => {
    expect(nonZeroPassPointsAtTheOutput(mutate(cliText, 'The cause is in the vitest output above', 'It failed'))).toBe(false);
  });
});
