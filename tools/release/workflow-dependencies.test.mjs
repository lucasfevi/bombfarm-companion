import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const releaseToolsDir = join(root, 'tools/release');
const workflowsDir = join(root, '.github/workflows');

/**
 * A job that runs a `tools/release` module must install the packages that module reaches.
 *
 * `release-prod.yml`'s publish job imported `@manypkg/get-packages` and `semver` with no
 * `pnpm install` in front of them. Nothing caught it for the life of the workflow, because the
 * job was gated off and had never once executed — the first real run died at module resolution,
 * after a 5-minute Windows packaging job had already produced the installer. Its summary job
 * carried the same defect one step further out: the `semver` import sat behind
 * `if publish succeeded`, so it would only ever have fired on the run that finally worked.
 *
 * A workflow step cannot be unit-tested, so the dependency edge is asserted here as text: which
 * modules a job invokes, what those modules import once relative imports are followed, and
 * whether the job installs anything.
 */

/** Every non-test module under `tools/release`, mapped to what it imports. */
function readModuleImports() {
  const imports = new Map();
  for (const name of readdirSync(releaseToolsDir)) {
    if (!name.endsWith('.mjs') || name.endsWith('.test.mjs')) continue;
    const source = readFileSync(join(releaseToolsDir, name), 'utf8');
    const specifiers = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);
    imports.set(name, {
      thirdParty: specifiers.filter(
        (specifier) => !specifier.startsWith('node:') && !specifier.startsWith('.'),
      ),
      local: specifiers
        .filter((specifier) => specifier.startsWith('.'))
        .map((specifier) => specifier.replace(/^\.\//, '')),
    });
  }
  return imports;
}

const MODULE_IMPORTS = readModuleImports();

/** Third-party packages a module needs, following its relative imports. */
function thirdPartyClosure(moduleName, seen = new Set()) {
  if (seen.has(moduleName) || !MODULE_IMPORTS.has(moduleName)) return [];
  seen.add(moduleName);
  const { thirdParty, local } = MODULE_IMPORTS.get(moduleName);
  return [...thirdParty, ...local.flatMap((name) => thirdPartyClosure(name, seen))];
}

/**
 * The workflow's jobs, as raw text. Split on two-space keys *after* the top-level `jobs:` line —
 * `on:`'s own `workflow_dispatch:` sits at the same indentation and is not a job.
 */
function splitJobs(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line === 'jobs:');
  const jobs = new Map();
  let current = null;
  for (const line of lines.slice(start + 1)) {
    const header = /^ {2}([a-z][a-z0-9_-]*):\s*$/.exec(line);
    if (header) {
      current = header[1];
      jobs.set(current, []);
      continue;
    }
    if (current !== null) jobs.get(current).push(line);
  }
  return new Map([...jobs].map(([name, body]) => [name, body.join('\n')]));
}

function installsDependencies(jobText) {
  return /pnpm install/.test(jobText);
}

function modulesInvokedBy(jobText) {
  return [...MODULE_IMPORTS.keys()].filter((name) => jobText.includes(`release/${name}`));
}

function missingDependencies(jobText) {
  if (installsDependencies(jobText)) return [];
  return [...new Set(modulesInvokedBy(jobText).flatMap((name) => thirdPartyClosure(name)))];
}

const WORKFLOWS = readdirSync(workflowsDir).filter((name) => name.endsWith('.yml'));

describe('every workflow job installs what the release tools it runs import', () => {
  for (const name of WORKFLOWS) {
    const text = readFileSync(join(workflowsDir, name), 'utf8');

    it(`${name} leaves no job importing a package it never installed`, () => {
      const offenders = [...splitJobs(text)]
        .map(([job, body]) => [job, missingDependencies(body)])
        .filter(([, missing]) => missing.length > 0);
      expect(offenders).toEqual([]);
    });
  }

  /**
   * The predicate has to be capable of failing, or this file passes by describing nothing. The
   * mutation reproduces the exact defect: the publish job, with its install step taken away.
   */
  it('the predicate catches the defect it was written for', () => {
    const text = readFileSync(join(workflowsDir, 'release-prod.yml'), 'utf8');
    const publish = splitJobs(text).get('publish');

    expect(missingDependencies(publish)).toEqual([]);
    expect(missingDependencies(publish.replace('run: pnpm install --frozen-lockfile', 'run: true')))
      .toEqual(expect.arrayContaining(['@manypkg/get-packages', 'semver']));
  });

  /** The closure has to follow relative imports, or a module's indirect needs read as none. */
  it('follows relative imports rather than only direct ones', () => {
    expect(thirdPartyClosure('aggregated-release-notes.mjs')).toContain('@manypkg/get-packages');
    expect(thirdPartyClosure('release-tag.mjs')).toContain('semver');
    expect(thirdPartyClosure('version-diff.mjs')).toEqual([]);
  });

  it('reads the real job list, not an empty one', () => {
    const jobs = splitJobs(readFileSync(join(workflowsDir, 'release-prod.yml'), 'utf8'));
    expect([...jobs.keys()]).toEqual(['plan', 'package', 'publish', 'summary']);
  });
});
