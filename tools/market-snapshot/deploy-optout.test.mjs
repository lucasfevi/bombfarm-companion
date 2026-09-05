/**
 * The opt-out's own proof, aimed at the entry point the publishing workflows actually call: they
 * run this module as a script against a temporary worktree and then commit whatever it wrote.
 *
 * A push to the data branch would otherwise start a preview build of a tree with no application
 * in it, which fails and mails the owner every time. The opt-out only works if it names the branch
 * being pushed, so the branch name is varied rather than asserted against the default alone.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { DEPLOY_OPTOUT_PATHS, writeDeployOptOut } from './deploy-optout.mjs';

const worktrees = [];

const emptyWorktree = () => {
  const root = mkdtempSync(join(tmpdir(), 'market-optout-'));
  worktrees.push(root);
  return root;
};

afterEach(() => {
  while (worktrees.length > 0) rmSync(worktrees.pop(), { recursive: true, force: true });
});

describe('the deployment opt-out the published branch carries', () => {
  it.each(['market-data', 'bombfarm-elsewhere'])(
    'disables deployment for %s at every path the setting is read from',
    (dataBranch) => {
      const root = emptyWorktree();
      writeDeployOptOut(root, dataBranch);

      expect(DEPLOY_OPTOUT_PATHS.length).toBeGreaterThan(1);
      for (const path of DEPLOY_OPTOUT_PATHS) {
        const written = JSON.parse(readFileSync(join(root, path), 'utf-8'));
        expect(written.git.deploymentEnabled).toEqual({ [dataBranch]: false });
      }
    },
  );

  it('writes the same payload to each path, so the copies cannot disagree', () => {
    const root = emptyWorktree();
    writeDeployOptOut(root, 'market-data');

    const bodies = DEPLOY_OPTOUT_PATHS.map((path) => readFileSync(join(root, path), 'utf-8'));
    expect(new Set(bodies).size).toBe(1);
  });
});
