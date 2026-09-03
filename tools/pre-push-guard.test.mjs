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
