import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/**
 * The rail merges `main` into `release/next` with `-s ours` before versioning, so that
 * `main` is an ancestor of the release head. Without it the release PR's merge base falls
 * back to `develop`'s tip at the previous release, and every run conflicts on the
 * `version` fields and `CHANGELOG.md` sections both sides bumped from that shared base.
 *
 * `-s ours` discards `main`'s tree wholesale, so it is only safe while every commit on
 * `main` came from the release rail. A commit landed directly on `main` — a hotfix, a
 * revert, an edit through the web UI — would be silently dropped by the next release.
 * This module is the guard: it refuses to reconcile when it sees one.
 *
 * The release PR is merged with a **merge commit**, not squashed, so `main` inherits the
 * release branch's real history rather than a content-equal snapshot of it. That is what
 * keeps `git log main..develop` — and the next release PR's commit list — honest. It also
 * means three rail-authored commits now reach `main` that a squash used to flatten away:
 * the merge commit itself, the version bump, and the previous reconcile merge. All three
 * are recognised below; anything else still stops the release.
 */

/**
 * Commit subjects the release rail is allowed to put on `main`.
 *
 * - The release merge/squash commit. Historical releases were squashed by GitHub as
 *   `chore(release): develop → main (#25)`; the same subject is reused for the merge
 *   commit when the repository writes merge titles from the PR title. Both the unicode
 *   arrow used in the PR title and a plain ASCII `->` are accepted.
 * - GitHub's default merge-commit subject, used when merge titles are left on the
 *   `Merge pull request #N from <owner>/<branch>` default.
 * - `changeset version`'s bump commit and the reconcile merge, both authored on
 *   `release/next` and pulled onto `main` by the merge.
 */
export const RAIL_COMMIT_PATTERNS = [
  /^chore\(release\): develop (?:→|->) main\b/,
  /^Merge pull request #\d+ from \S+\/release\/next\b/,
  /^chore\(release\): version packages$/,
  /^chore\(release\): reconcile main's squashed release history$/,
];

/**
 * @typedef {{ sha: string, subject: string }} CommitSummary
 * @typedef {{ safe: boolean, unexpected: CommitSummary[] }} ReconcileAssessment
 */

/**
 * Parses `git log --format='%H%x09%s'` output.
 *
 * @param {string} logText
 * @returns {CommitSummary[]}
 */
export function parseCommitLog(logText) {
  /** @type {CommitSummary[]} */
  const commits = [];

  for (const rawLine of logText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const tab = line.indexOf('\t');
    if (tab === -1) {
      commits.push({ sha: line, subject: '' });
      continue;
    }

    commits.push({
      sha: line.slice(0, tab),
      subject: line.slice(tab + 1),
    });
  }

  return commits;
}

/**
 * @param {CommitSummary} commit
 * @returns {boolean}
 */
export function isReleaseCommit(commit) {
  return RAIL_COMMIT_PATTERNS.some((pattern) => pattern.test(commit.subject));
}

/**
 * Decides whether `main` can be reconciled with `-s ours`.
 *
 * @param {CommitSummary[]} mainOnlyCommits commits reachable from `main` but not from
 *   the release branch — i.e. what `-s ours` would discard.
 * @returns {ReconcileAssessment}
 */
export function assessMainCommits(mainOnlyCommits) {
  const unexpected = mainOnlyCommits.filter((commit) => !isReleaseCommit(commit));
  return { safe: unexpected.length === 0, unexpected };
}

/**
 * @param {CommitSummary[]} unexpected
 * @returns {string}
 */
export function formatReconcileRefusal(unexpected) {
  const lines = [
    'Refusing to reconcile: main carries commits the release rail did not put there.',
    '',
    'Merging with -s ours would discard them silently. Review each one:',
    '',
  ];

  for (const commit of unexpected) {
    lines.push(`  ${commit.sha.slice(0, 7)}  ${commit.subject}`);
  }

  lines.push(
    '',
    'If the change belongs in the release, port it to develop and re-run.',
    'If main is genuinely ahead, merge main into develop before releasing.',
  );

  return lines.join('\n');
}

/**
 * @param {string[]} argv
 * @returns {number}
 */
export function runCli(argv) {
  const [logPath] = argv;
  if (!logPath) {
    process.stderr.write('usage: main-reconcile.mjs <git-log-file>\n');
    return 2;
  }

  const { safe, unexpected } = assessMainCommits(
    parseCommitLog(readFileSync(logPath, 'utf8')),
  );

  if (safe) {
    process.stdout.write('main carries only release-rail commits; safe to reconcile.\n');
    return 0;
  }

  process.stderr.write(`${formatReconcileRefusal(unexpected)}\n`);
  return 1;
}

const entryPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === entryPath) {
  process.exit(runCli(process.argv.slice(2)));
}
