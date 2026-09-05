/**
 * The shape guard for the scheduled snapshot workflow, and for the property that makes it safe:
 * that it is the only thing producing the artifact.
 *
 * Two producers writing one file is a race whichever of them happens to be running, so what is
 * pinned here is not just this workflow's own shape but the count of publishers across the whole
 * directory, and the absence of the publish path the long-running collector used to carry. A
 * dormant second writer reads as removed and is not.
 *
 * Every predicate is a pure function over file text, asserted twice — true against the real file,
 * false against a mutation of that same text — so none of them can report green while having
 * stopped discriminating.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const WORKFLOWS = join(root, '.github/workflows');
const SCHEDULED_PATH = join(WORKFLOWS, 'market-snapshot.yml');
const MANUAL_PATH = join(WORKFLOWS, 'market-prices.yml');
const COLLECTOR_PATH = join(root, 'tools/market-snapshot/collect.mjs');

const workflow = readFileSync(SCHEDULED_PATH, 'utf-8');
const manual = readFileSync(MANUAL_PATH, 'utf-8');
const collector = readFileSync(COLLECTOR_PATH, 'utf-8');

/** Comments describe the very constraints under test; predicates must read YAML, not prose. */
function stripCommentLines(text) {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
}

function jobNames(text) {
  const lines = text.split('\n');
  const jobsIndex = lines.findIndex((line) => line === 'jobs:');
  if (jobsIndex === -1) return [];
  const names = [];
  for (let i = jobsIndex + 1; i < lines.length; i += 1) {
    const match = lines[i].match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (match) names.push(match[1]);
  }
  return names;
}

/** The git push spans three backslash-continued lines; fold them so one regex can read it. */
const joinContinuations = (text) => text.replace(/\\\n\s*/g, ' ');
const shellBody = (text) => joinContinuations(stripCommentLines(text));

const hasLiveSchedule = (text) =>
  /^\s*schedule:\s*$/m.test(text) && /^\s*-\s*cron:\s*'[^']+'/m.test(text);
/** Two runs an hour, which is the figure the alarm threshold was set against. */
const runsHalfHourly = (text) => /^\s*-\s*cron:\s*'\d+,\d+ \* \* \* \*'/m.test(text);
const singleJob = (text) => jobNames(text).length === 1;
const isTimeBoxed = (text) => /timeout-minutes:\s*\d+/.test(stripCommentLines(text));
const serialises = (text) => /cancel-in-progress:\s*false/.test(stripCommentLines(text));
const concurrencyGroup = (text) => stripCommentLines(text).match(/^\s*group:\s*(\S+)/m)?.[1];
const publishesWhateverItGot = (text) =>
  (stripCommentLines(text).match(/if:\s*always\(\)/g) ?? []).length >= 2;
const neverPushesToDefaultBranch = (text) => !/push[^\n]*\b(develop|main)\b/.test(shellBody(text));
const neverWritesPackages = (text) => !/packages\//.test(stripCommentLines(text));

const forcePushIsScopedToTheDataBranch = (text) => {
  const forcePushes = shellBody(text).match(/push --force[^\n]*/g) ?? [];
  return forcePushes.length > 0 && forcePushes.every((push) => /DATA_BRANCH/.test(push));
};

const optsOutOfDeployment = (text) => {
  const body = shellBody(text);
  const written = body.indexOf('deploy-optout.mjs');
  const committed = body.indexOf('commit -q -m');
  return written !== -1 && committed !== -1 && written < committed;
};

const stagesEverythingItWrote = (text) => /add -A\b/.test(shellBody(text));

/**
 * The per-item quote pass is the half a single address cannot afford, and an empty currency list
 * is how this run declines it. Name a currency here and the job is back to one call per item.
 */
const asksForNoNativeCurrency = (text) => /^\s*NATIVE_CURRENCIES:\s*''\s*$/m.test(text);

const pushingTo = (text, branch) =>
  text.replace(/(push --force[\s\S]*?)"\$DATA_BRANCH"/, `$1"${branch}"`);

describe('the scheduled snapshot workflow', () => {
  it('runs on a schedule, twice an hour, which is what the alarm is set against', () => {
    expect(hasLiveSchedule(workflow)).toBe(true);
    expect(hasLiveSchedule(workflow.replace('  schedule:', '  # schedule:'))).toBe(false);
    expect(hasLiveSchedule(workflow.replace(/^\s*-\s*cron:.*\n/m, ''))).toBe(false);

    expect(runsHalfHourly(workflow)).toBe(true);
    expect(runsHalfHourly(workflow.replace(/cron: '\d+,\d+ /, "cron: '23 */6 "))).toBe(false);
  });

  it('is one job, time-boxed well under GitHub six hour default', () => {
    expect(singleJob(workflow)).toBe(true);
    expect(singleJob(`${workflow}\n  publish:\n`)).toBe(false);

    expect(isTimeBoxed(workflow)).toBe(true);
    expect(isTimeBoxed(workflow.replace(/timeout-minutes:\s*\d+/, ''))).toBe(false);
  });

  /**
   * The manual rebuild writes the same asset. One shared group is what keeps a human asking for a
   * rebuild from racing a scheduled run, rather than merely making it unlikely.
   */
  it('serialises against itself and against the manual rebuild, in one shared group', () => {
    expect(serialises(workflow)).toBe(true);
    expect(
      serialises(workflow.replace('cancel-in-progress: false', 'cancel-in-progress: true')),
    ).toBe(false);

    expect(concurrencyGroup(workflow)).toBeTruthy();
    expect(concurrencyGroup(workflow)).toBe(concurrencyGroup(manual));
    expect(concurrencyGroup(workflow.replace(/^(\s*group:\s*)\S+/m, '$1market-snapshot'))).not.toBe(
      concurrencyGroup(manual),
    );
  });

  it('asks for no native currency, which is what makes it affordable on a schedule', () => {
    expect(asksForNoNativeCurrency(workflow)).toBe(true);
    expect(
      asksForNoNativeCurrency(workflow.replace(/NATIVE_CURRENCIES: ''/, "NATIVE_CURRENCIES: 'BRL'")),
    ).toBe(false);
    expect(asksForNoNativeCurrency(workflow.replace(/^\s*NATIVE_CURRENCIES:.*$/m, ''))).toBe(false);
  });

  it('publishes even when the sweep was cut short, so partial coverage is not thrown away', () => {
    expect(publishesWhateverItGot(workflow)).toBe(true);
    expect(publishesWhateverItGot(workflow.replace(/if:\s*always\(\)/g, 'if: success()'))).toBe(
      false,
    );
  });

  it('never commits to the default branch and never writes the source tree', () => {
    expect(neverPushesToDefaultBranch(workflow)).toBe(true);
    expect(neverPushesToDefaultBranch(pushingTo(workflow, 'develop'))).toBe(false);

    expect(neverWritesPackages(workflow)).toBe(true);
    expect(
      neverWritesPackages(`${workflow}\n          cp out.json packages/domain/src/data/\n`),
    ).toBe(false);
  });

  it('force-pushes only the derived data branch, carrying its own deployment opt-out', () => {
    expect(forcePushIsScopedToTheDataBranch(workflow)).toBe(true);
    expect(forcePushIsScopedToTheDataBranch(pushingTo(workflow, 'develop'))).toBe(false);

    expect(optsOutOfDeployment(workflow)).toBe(true);
    expect(optsOutOfDeployment(workflow.replace(/^.*deploy-optout\.mjs.*$/m, ''))).toBe(false);

    expect(stagesEverythingItWrote(workflow)).toBe(true);
    expect(stagesEverythingItWrote(workflow.replace('add -A', 'add "$SNAPSHOT"'))).toBe(false);
  });
});

/**
 * The artifact has one producer. Asserted as a count over the whole directory rather than about
 * this one file, because the failure being prevented is a second producer appearing elsewhere.
 */
describe('exactly one thing publishes the snapshot', () => {
  const workflowFiles = () =>
    readdirSync(WORKFLOWS)
      .filter((name) => name.endsWith('.yml'))
      .map((name) => ({ name, text: readFileSync(join(WORKFLOWS, name), 'utf-8') }));

  const publishesTheSnapshot = (text) => /gh release upload "\$RELEASE_TAG"/.test(shellBody(text));

  it('names both publishers, and only one of them is on a schedule', () => {
    const publishers = workflowFiles().filter((file) => publishesTheSnapshot(file.text));
    expect(publishers.map((file) => file.name).sort()).toEqual([
      'market-prices.yml',
      'market-snapshot.yml',
    ]);

    const scheduled = publishers.filter((file) => hasLiveSchedule(file.text));
    expect(scheduled.map((file) => file.name)).toEqual(['market-snapshot.yml']);
  });

  /**
   * The collector used to upload the release asset and force-push the branch itself. Deleting the
   * two calls while leaving the module able to make them is the shape this asserts against:
   * nothing there may reach the publishing API, by hostname or by the route that updates a ref.
   */
  it('leaves the collector no way to publish, by API host or by ref update', () => {
    const reachesThePublishingApi = (source) =>
      /api\.github\.com|uploads\.github\.com|git\/refs\/heads|releases\/assets/.test(source);

    expect(reachesThePublishingApi(collector)).toBe(false);
    expect(
      reachesThePublishingApi(`${collector}\nawait fetch('https://api.github.com/repos/x/y');`),
    ).toBe(true);

    // The predicate has to be able to see one, or its silence above says nothing at all.
    expect(reachesThePublishingApi("await fetch('https://uploads.github.com/x');")).toBe(true);
  });

  it('exports nothing that publishes, so no caller can wire one back up', async () => {
    const module = await import('./market-snapshot/collect.mjs');

    expect(Object.keys(module).filter((name) => /publish/i.test(name))).toEqual([]);
    // It still exports what the collector is for, so the empty list above is not an empty module.
    expect(Object.keys(module)).toContain('runCollector');
    expect(Object.keys(module)).toContain('createHistory');
  });
});
