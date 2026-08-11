import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assessMainCommits,
  formatReconcileRefusal,
  isReleaseCommit,
  parseCommitLog,
  runCli,
} from './main-reconcile.mjs';

/** Real subject GitHub wrote squash-merging release PR #25. */
const RELEASE_25 = 'chore(release): develop → main (#25)';
const RELEASE_17 = 'chore(release): develop → main (#17)';

function logFile(contents) {
  const dir = mkdtempSync(join(tmpdir(), 'main-reconcile-'));
  const path = join(dir, 'main-only.tsv');
  writeFileSync(path, contents);
  return path;
}

describe('parseCommitLog', () => {
  it('reads sha and subject from tab-separated git log output', () => {
    const commits = parseCommitLog(
      `6f71fdd020ad0c3e7ea77c8db49322aebef1b64f\t${RELEASE_25}\n` +
        `814ab06020ad0c3e7ea77c8db49322aebef1b64f\t${RELEASE_17}\n`,
    );

    expect(commits).toEqual([
      {
        sha: '6f71fdd020ad0c3e7ea77c8db49322aebef1b64f',
        subject: RELEASE_25,
      },
      {
        sha: '814ab06020ad0c3e7ea77c8db49322aebef1b64f',
        subject: RELEASE_17,
      },
    ]);
  });

  it('ignores blank lines, including a trailing newline', () => {
    expect(parseCommitLog(`abc123\t${RELEASE_25}\n\n`)).toHaveLength(1);
  });

  it('returns nothing when main is already an ancestor', () => {
    expect(parseCommitLog('')).toEqual([]);
  });

  it('keeps a subject containing tabs intact after the first separator', () => {
    const [commit] = parseCommitLog('abc123\tchore: a\tb');
    expect(commit.subject).toBe('chore: a\tb');
  });

  it('tolerates a sha with no subject', () => {
    expect(parseCommitLog('abc123')).toEqual([{ sha: 'abc123', subject: '' }]);
  });
});

describe('isReleaseCommit', () => {
  it('accepts the squash subject GitHub writes for the release PR', () => {
    expect(isReleaseCommit({ sha: 'abc', subject: RELEASE_25 })).toBe(true);
  });

  it('accepts an ASCII arrow as well as the unicode one', () => {
    expect(
      isReleaseCommit({ sha: 'abc', subject: 'chore(release): develop -> main (#4)' }),
    ).toBe(true);
  });

  it('accepts the subject without a PR number', () => {
    expect(
      isReleaseCommit({ sha: 'abc', subject: 'chore(release): develop → main' }),
    ).toBe(true);
  });

  it('rejects the sync commit, which belongs on develop rather than main', () => {
    expect(
      isReleaseCommit({
        sha: 'abc',
        subject: 'chore(release): sync versions to develop (#36)',
      }),
    ).toBe(false);
  });

  it('rejects a revert of a release commit', () => {
    expect(
      isReleaseCommit({ sha: 'abc', subject: `Revert "${RELEASE_25}"` }),
    ).toBe(false);
  });

  it('rejects an unrelated chore(release) subject', () => {
    expect(
      isReleaseCommit({ sha: 'abc', subject: 'chore(release): version packages' }),
    ).toBe(false);
  });
});

describe('assessMainCommits', () => {
  it('is safe when main carries nothing at all', () => {
    expect(assessMainCommits([])).toEqual({ safe: true, unexpected: [] });
  });

  it('is safe when main carries only release commits', () => {
    const assessment = assessMainCommits([
      { sha: '6f71fdd', subject: RELEASE_25 },
      { sha: '814ab06', subject: RELEASE_17 },
    ]);

    expect(assessment).toEqual({ safe: true, unexpected: [] });
  });

  it('refuses when a hotfix landed directly on main', () => {
    const hotfix = { sha: 'deadbee', subject: 'fix(web): patch the crash in prod' };
    const assessment = assessMainCommits([
      { sha: '6f71fdd', subject: RELEASE_25 },
      hotfix,
    ]);

    expect(assessment).toEqual({ safe: false, unexpected: [hotfix] });
  });

  it('reports every unexpected commit, not just the first', () => {
    const { unexpected } = assessMainCommits([
      { sha: 'aaa', subject: 'fix: one' },
      { sha: '6f71fdd', subject: RELEASE_25 },
      { sha: 'bbb', subject: 'fix: two' },
    ]);

    expect(unexpected.map((commit) => commit.sha)).toEqual(['aaa', 'bbb']);
  });
});

describe('formatReconcileRefusal', () => {
  it('names each discarded commit by short sha and subject', () => {
    const message = formatReconcileRefusal([
      { sha: 'deadbeefcafe', subject: 'fix(web): patch the crash in prod' },
    ]);

    expect(message).toContain('deadbee');
    expect(message).toContain('fix(web): patch the crash in prod');
    expect(message).toContain('port it to develop');
  });
});

describe('runCli', () => {
  it('exits 0 when main carries only release commits', () => {
    expect(runCli([logFile(`6f71fdd\t${RELEASE_25}\n`)])).toBe(0);
  });

  it('exits 0 on an empty log', () => {
    expect(runCli([logFile('')])).toBe(0);
  });

  it('exits 1 when an unexpected commit would be discarded', () => {
    expect(runCli([logFile('deadbee\tfix(web): hotfix straight onto main\n')])).toBe(1);
  });

  it('exits 2 when no log path is given', () => {
    expect(runCli([])).toBe(2);
  });
});
