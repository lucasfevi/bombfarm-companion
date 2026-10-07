import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CONVENTIONAL_BRANCH_TYPES,
  DEFAULT_PROTECTED_BRANCHES,
  NAMING_EXEMPT_BRANCHES,
  evaluatePushRefs,
  formatNamingRefusalMessage,
  formatRefusalMessage,
} from './pre-push-guard.mjs';

const protectedBranches = ['main', 'develop'];
const sha = 'a'.repeat(40);
const zero = '0'.repeat(40);

function line(localRef, localSha, remoteRef, remoteSha = sha) {
  return `${localRef} ${localSha} ${remoteRef} ${remoteSha}`;
}

describe('evaluatePushRefs', () => {
  it('pins main and develop as the default protected branches', () => {
    expect(DEFAULT_PROTECTED_BRANCHES).toEqual(['main', 'develop']);
  });

  it('blocks a push to main and names the develop PR flow', () => {
    const result = evaluatePushRefs(
      line('refs/heads/main', sha, 'refs/heads/main'),
      { protectedBranches },
    );
    expect(result.allowed).toBe(false);
    expect(result.blocked).toEqual(['main']);
    expect(formatRefusalMessage(result.blocked)).toContain('Open a PR into develop');
    expect(formatRefusalMessage(result.blocked)).toContain('--no-verify');
  });

  it('blocks a push to develop', () => {
    const result = evaluatePushRefs(
      line('refs/heads/develop', sha, 'refs/heads/develop'),
      { protectedBranches },
    );
    expect(result.allowed).toBe(false);
    expect(result.blocked).toEqual(['develop']);
  });

  it('allows a push to feat/x', () => {
    const result = evaluatePushRefs(
      line('refs/heads/feat/x', sha, 'refs/heads/feat/x'),
      { protectedBranches },
    );
    expect(result.allowed).toBe(true);
    expect(result.blocked).toEqual([]);
  });

  /**
   * `gh-pages` was exempt while CI published visual reports to it. Nothing pushes it now, so the
   * naming rule applies to it like any other name — and a reintroduced exemption would be dead
   * config that quietly re-permits the branch.
   */
  it('holds gh-pages to the naming rule, its CI publisher being gone', () => {
    expect(NAMING_EXEMPT_BRANCHES).not.toContain('gh-pages');

    const result = evaluatePushRefs(
      line('refs/heads/gh-pages', sha, 'refs/heads/gh-pages'),
      { protectedBranches },
    );
    expect(result.allowed).toBe(false);
  });

  it('blocks a delete-push (all-zero local sha) to a protected branch', () => {
    const result = evaluatePushRefs(
      line('refs/heads/develop', zero, 'refs/heads/develop'),
      { protectedBranches },
    );
    expect(result.allowed).toBe(false);
    expect(result.blocked).toEqual(['develop']);
  });

  it('blocks when multiple refs include one protected branch', () => {
    const stdin = [
      line('refs/heads/feat/x', sha, 'refs/heads/feat/x'),
      line('refs/heads/main', sha, 'refs/heads/main'),
    ].join('\n');
    const result = evaluatePushRefs(stdin, { protectedBranches });
    expect(result.allowed).toBe(false);
    expect(result.blocked).toEqual(['main']);
  });

  it('allows empty stdin', () => {
    const result = evaluatePushRefs('', { protectedBranches });
    expect(result.allowed).toBe(true);
    expect(result.blocked).toEqual([]);
  });
});

describe('conventional branch names', () => {
  function push(branch, localSha = sha) {
    return evaluatePushRefs(line(`refs/heads/${branch}`, localSha, `refs/heads/${branch}`), {
      protectedBranches,
    });
  }

  it('pins the commitlint type set', () => {
    expect(CONVENTIONAL_BRANCH_TYPES).toEqual([
      'build',
      'chore',
      'ci',
      'docs',
      'feat',
      'fix',
      'perf',
      'refactor',
      'revert',
      'style',
      'test',
    ]);
  });

  it('accepts every conventional type', () => {
    for (const type of CONVENTIONAL_BRANCH_TYPES) {
      const result = push(`${type}/some-real-summary`);
      expect(result.misnamed, type).toEqual([]);
      expect(result.allowed, type).toBe(true);
    }
  });

  it('rejects a generated branch name with a random suffix', () => {
    const result = push('claude/code-comment-policy-924368');
    expect(result.allowed).toBe(false);
    expect(result.misnamed).toEqual(['claude/code-comment-policy-924368']);
  });

  it.each([
    ['no type segment', 'comments'],
    ['a personal prefix', 'lucas/wip'],
    ['an uppercase summary', 'feat/ACS-06'],
    ['an empty summary', 'feat/'],
    ['a nested segment', 'feat/web/panel'],
    ['an underscore separator', 'feat/rotation_pool'],
  ])('rejects %s', (_label, branch) => {
    const result = push(branch);
    expect(result.allowed).toBe(false);
    expect(result.misnamed).toEqual([branch]);
  });

  it.each(NAMING_EXEMPT_BRANCHES.filter((branch) => !protectedBranches.includes(branch)))(
    'exempts the machine branch %s',
    (branch) => {
      const result = push(branch);
      expect(result.allowed).toBe(true);
      expect(result.misnamed).toEqual([]);
    },
  );

  it('exempts backup snapshots', () => {
    const result = push('backup/memory-retirement-prerebase');
    expect(result.allowed).toBe(true);
    expect(result.misnamed).toEqual([]);
  });

  it('allows deleting a badly-named branch, which is how a rename finishes', () => {
    const result = push('claude/code-comment-policy-924368', zero);
    expect(result.allowed).toBe(true);
    expect(result.misnamed).toEqual([]);
  });

  it('reports a protected branch as blocked, not as misnamed', () => {
    const result = push('develop');
    expect(result.blocked).toEqual(['develop']);
    expect(result.misnamed).toEqual([]);
  });

  it('reports both refusals when one push carries each', () => {
    const stdin = [
      line('refs/heads/main', sha, 'refs/heads/main'),
      line('refs/heads/lucas/wip', sha, 'refs/heads/lucas/wip'),
    ].join('\n');
    const result = evaluatePushRefs(stdin, { protectedBranches });
    expect(result.allowed).toBe(false);
    expect(result.blocked).toEqual(['main']);
    expect(result.misnamed).toEqual(['lucas/wip']);
  });

  it('names the rename command and the hard truth in the refusal', () => {
    const message = formatNamingRefusalMessage(['lucas/wip']);
    expect(message).toContain('lucas/wip');
    expect(message).toContain('git branch -m');
    expect(message).toContain('docs/branching.md#branch-names');
    expect(message).toContain('--no-verify');
  });
});

/**
 * Everything above exercises `pre-push-guard.mjs`'s decision logic and none of it ever opened
 * `.husky/pre-push`. Unwire the hook and every assertion in this file still passes: a thorough
 * suite comparing the residue of a guard that no longer runs on anybody's push.
 *
 * What "installed" means here is narrower than the POSIX habit suggests. Husky's generated
 * `.husky/_` shim sources the hook through `sh -e "$s"`, so the exec bit is never consulted — the
 * hook is correctly tracked at mode 100644 and pinning that mode would guard a fact nothing
 * depends on. What the `sh -e` invocation IS sensitive to is line endings: a CRLF body makes the
 * shell read `node tools/pre-push-guard.mjs\r` and fail on a command nobody can find, which is
 * why `.gitattributes` pins `.husky/*` to LF. Hence the four committed facts below — tracked, LF
 * in both the index and the working tree, invoking a guard module that resolves to a real file,
 * and a `prepare` script that reinstalls the shim on every install.
 *
 * Deliberately NOT asserted: the contents of `.husky/_` and the value of `core.hooksPath`. Both
 * are per-install generated state that `prepare` rewrites, so asserting them would check the
 * machine the suite happens to run on rather than the repository — and a git worktree inherits
 * `core.hooksPath` from the primary checkout as an absolute path, which would red here for a
 * reason that has nothing to do with the hook.
 */
describe('the pre-push hook that runs this guard is wired, not just correct', () => {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const HOOK_PATH = '.husky/pre-push';
  const GUARD_MODULE = 'tools/pre-push-guard.mjs';

  function git(args) {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  }

  /** The hook's own bytes, as `sh -e` will read them — the working-tree file, not the index blob. */
  function hookBody() {
    return readFileSync(join(root, HOOK_PATH), 'utf8');
  }

  /** The operative lines of a shell script: blanks and `#` comments carry no command. */
  function operativeLines(body) {
    return body
      .split('\n')
      .map((line) => line.replace(/\r$/, '').trim())
      .filter((line) => line !== '' && !line.startsWith('#'));
  }

  it('is tracked by git, so it reaches every clone rather than only this working tree', () => {
    expect(
      git(['ls-files', '--', HOOK_PATH]).trim(),
      `${HOOK_PATH} is not tracked. An untracked hook guards this machine and nobody else's.`,
    ).toBe(HOOK_PATH);
  });

  it('is stored and checked out with LF endings, which is what `sh -e` can run', () => {
    // `git ls-files --eol` is how `tools/line-endings.test.mjs` reads endings; both columns are
    // asserted because the index copy is what other clones get and the working-tree copy is what
    // husky actually executes.
    const [indexEol, worktreeEol] = git(['ls-files', '--eol', '--', HOOK_PATH]).trim().split(/\s+/);
    expect(
      [indexEol, worktreeEol],
      `${HOOK_PATH} must be LF on both sides: a CRLF body makes \`sh -e\` read the trailing CR as ` +
        'part of the command and the hook dies before it can refuse anything. See `.gitattributes`.',
    ).toEqual(['i/lf', 'w/lf']);
  });

  it('invokes a guard module that resolves to a file that exists', () => {
    const referenced = [...hookBody().matchAll(/tools\/[\w.-]+\.mjs/g)].map((match) => match[0]);
    expect(referenced, `${HOOK_PATH} names no tools/*.mjs module to run`).toContain(GUARD_MODULE);
    for (const modulePath of referenced) {
      expect(
        existsSync(join(root, modulePath)),
        `${HOOK_PATH} runs ${modulePath}, which does not exist — the hook fires and does nothing.`,
      ).toBe(true);
    }
  });

  it('non-vacuity: the hook body carries at least one command', () => {
    const lines = operativeLines(hookBody());
    expect(
      lines.length,
      `${HOOK_PATH} has no operative line. An empty hook exits 0 and permits every push.`,
    ).toBeGreaterThan(0);
    expect(lines.some((line) => line.includes(GUARD_MODULE))).toBe(true);
  });

  it('`prepare` runs husky, which is what points git at the hook directory on install', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(
      manifest.scripts?.prepare,
      'without a `prepare` script running husky, a fresh clone installs no hooks at all and the ' +
        'tracked hook above never fires.',
    ).toMatch(/\bhusky\b/);
  });
});
