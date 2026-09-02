/**
 * The shape guard for the market snapshot workflow. It holds `contents: write`, so the
 * things worth pinning are what it must never write: no commit to the default branch, nothing
 * under `packages/**`, and no second job that could quietly gain those rights later.
 *
 * Every predicate is a pure function over workflow text, asserted twice — true against the real
 * file, false against a mutation of that same text — so none of them can report green while
 * having stopped discriminating.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const WORKFLOW_PATH = join(root, '.github/workflows/market-prices.yml');
const BUILDER_PATH = join(root, 'tools/market-snapshot/build.mjs');
const COLLECTOR_PATH = join(root, 'tools/market-snapshot/collect.mjs');

const workflow = readFileSync(WORKFLOW_PATH, 'utf-8');
const builder = readFileSync(BUILDER_PATH, 'utf-8');
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

const singleJob = (text) => jobNames(text).length === 1;
const hasLiveSchedule = (text) =>
  /^\s*schedule:\s*$/m.test(text) && /^\s*-\s*cron:\s*'[^']+'/m.test(text);
const isManualOnly = (text) =>
  /^\s*workflow_dispatch:\s*$/m.test(text) && !hasLiveSchedule(text);
const serialises = (text) => /cancel-in-progress:\s*false/.test(stripCommentLines(text));
const isTimeBoxed = (text) => /timeout-minutes:\s*\d+/.test(stripCommentLines(text));
const publishesWhateverItGot = (text) =>
  (stripCommentLines(text).match(/if:\s*always\(\)/g) ?? []).length >= 2;

/** The git push spans three backslash-continued lines; fold them so one regex can read it. */
const joinContinuations = (text) => text.replace(/\\\n\s*/g, ' ');

const shellBody = (text) => joinContinuations(stripCommentLines(text));

/** Nothing in the job may push to a branch this repository releases from. */
const neverPushesToDefaultBranch = (text) => !/push[^\n]*\b(develop|main)\b/.test(shellBody(text));

/** The published data lives on its own branch and in a release asset, never in the source tree. */
const neverWritesPackages = (text) => !/packages\//.test(stripCommentLines(text));

const forcePushIsScopedToTheDataBranch = (text) => {
  const forcePushes = shellBody(text).match(/push --force[^\n]*/g) ?? [];
  return forcePushes.length > 0 && forcePushes.every((push) => /DATA_BRANCH/.test(push));
};

/**
 * The published commit must carry its own deployment opt-out, written before it is committed —
 * a push to a branch without one starts a preview build of a tree with no application in it.
 */
const optsOutOfDeployment = (text) => {
  const body = shellBody(text);
  const written = body.indexOf('deploy-optout.mjs');
  const committed = body.indexOf('commit -q -m');
  return written !== -1 && committed !== -1 && written < committed;
};

/** Staging the snapshot by name would drop the opt-out while leaving every other check green. */
const stagesEverythingItWrote = (text) => /add -A\b/.test(shellBody(text));

/** The workflow with the branch its force-push targets swapped, leaving the rest intact. */
const pushingTo = (text, branch) =>
  text.replace(/(push --force[\s\S]*?)"\$DATA_BRANCH"/, `$1"${branch}"`);

describe('the market-prices workflow', () => {
  it('runs only when a human asks, and serialises overlapping runs', () => {
    expect(isManualOnly(workflow)).toBe(true);

    // A reintroduced cron would race the routine producer and publish over what it produced.
    expect(
      isManualOnly(workflow.replace(/^on:$/m, "on:\n  schedule:\n    - cron: '23 */6 * * *'")),
    ).toBe(false);
    // And the manual lever itself must not quietly disappear either.
    expect(isManualOnly(workflow.replace(/^\s*workflow_dispatch:\s*$/m, ''))).toBe(false);

    expect(serialises(workflow)).toBe(true);
    expect(serialises(workflow.replace('cancel-in-progress: false', 'cancel-in-progress: true'))).toBe(
      false,
    );
  });

  it('is one job, time-boxed well under GitHub six hour default', () => {
    expect(singleJob(workflow)).toBe(true);
    expect(singleJob(`${workflow}\n  publish:\n`)).toBe(false);

    expect(isTimeBoxed(workflow)).toBe(true);
    expect(isTimeBoxed(workflow.replace(/timeout-minutes:\s*\d+/, ''))).toBe(false);
  });

  it('publishes even when the sweep was cut short, so partial coverage is not thrown away', () => {
    expect(publishesWhateverItGot(workflow)).toBe(true);
    expect(publishesWhateverItGot(workflow.replace(/if:\s*always\(\)/g, "if: success()"))).toBe(
      false,
    );
  });

  it('never commits to the default branch and never writes the source tree', () => {
    expect(neverPushesToDefaultBranch(workflow)).toBe(true);
    expect(neverPushesToDefaultBranch(pushingTo(workflow, 'develop'))).toBe(false);

    expect(neverWritesPackages(workflow)).toBe(true);
    expect(neverWritesPackages(`${workflow}\n          cp out.json packages/domain/src/data/\n`)).toBe(
      false,
    );
  });

  it('publishes a commit that opts itself out of being deployed', () => {
    expect(optsOutOfDeployment(workflow)).toBe(true);

    // Dropping the write leaves a commit that is built, fails, and mails the owner every pass.
    expect(optsOutOfDeployment(workflow.replace(/^.*deploy-optout\.mjs.*$/m, ''))).toBe(false);
    // Writing it after the commit is the same branch with the same emails and a green suite.
    expect(
      optsOutOfDeployment(
        workflow
          .replace(/^.*deploy-optout\.mjs.*$/m, '')
          .replace(/(commit -q -m[^\n]*\n)/, '$1          node tools/market-snapshot/deploy-optout.mjs "$tmp" "$DATA_BRANCH"\n'),
      ),
    ).toBe(false);

    expect(stagesEverythingItWrote(workflow)).toBe(true);
    expect(stagesEverythingItWrote(workflow.replace('add -A', 'add "$SNAPSHOT"'))).toBe(false);
  });

  it('force-pushes only the derived data branch', () => {
    expect(forcePushIsScopedToTheDataBranch(workflow)).toBe(true);
    expect(forcePushIsScopedToTheDataBranch(pushingTo(workflow, 'develop'))).toBe(false);
  });
});

describe('the snapshot builder', () => {
  const pricingSource = (file) =>
    readFileSync(join(root, 'packages/pricing/src/market', file), 'utf-8');
  const callsFetch = (source) => /\bfetch\s*\(/.test(source);
  const SHIPPED = ['discover.ts', 'endpoints.ts', 'reconcile.ts', 'snapshot.ts', 'resolve.ts'];

  it('performs every network call itself, so no shipped package can reach Steam', () => {
    expect(callsFetch(builder)).toBe(true);

    const shipped = SHIPPED.map(pricingSource).join('\n');
    expect(callsFetch(shipped)).toBe(false);
    expect(callsFetch(`${shipped}\nawait fetch(url);`)).toBe(true);
  });

  it('leaves URL building in the package, so the sweep and the apps address Steam identically', () => {
    expect(/steamcommunity\.com/.test(pricingSource('endpoints.ts'))).toBe(true);
    expect(/steamcommunity\.com/.test(builder)).toBe(false);
  });

  /**
   * The collector drives the sweep, so the builder stays the only Steam-talker. The injected
   * network bundle is the one handle through which another file could reach Steam anyway, which
   * is why its name is guarded exactly as tightly as the hostname.
   */
  it('keeps the collector off Steam, by hostname and by the handle that would let it in', () => {
    const namesSteam = (source) => /steamcommunity\.com/.test(source);
    const injectsTheNetwork = (source) => /\bsteamNet\b/.test(source);

    expect(namesSteam(collector)).toBe(false);
    expect(namesSteam(`${collector}\nconst url = 'https://steamcommunity.com/market/';`)).toBe(true);

    expect(injectsTheNetwork(collector)).toBe(false);
    expect(injectsTheNetwork(`${collector}\nawait runSweep({ steamNet: mine });`)).toBe(true);
  });
});
