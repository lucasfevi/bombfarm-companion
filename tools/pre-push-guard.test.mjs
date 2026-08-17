import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROTECTED_BRANCHES,
  evaluatePushRefs,
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

  it('allows a push to gh-pages', () => {
    const result = evaluatePushRefs(
      line('refs/heads/gh-pages', sha, 'refs/heads/gh-pages'),
      { protectedBranches },
    );
    expect(result.allowed).toBe(true);
    expect(result.blocked).toEqual([]);
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
