import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/**
 * Squash-merging the `release/next` → `main` PR gives `main` a commit that shares no
 * history with the branch it came from, so `main` permanently forks from `develop` and
 * every later release PR conflicts on add/add across a stale merge base.
 *
 * The rail fixes that by merging `main` into `release/next` with `-s ours` before
 * pushing: `main` becomes an ancestor, the tree stays exactly what `develop` produced,
 * and the squash onto `main` still leaves `main` linear.
 *
 * `-s ours` discards `main`'s tree wholesale, so it is only safe while every commit on
 * `main` came from the release rail. A commit landed directly on `main` — a hotfix, a
 * revert, an edit through the web UI — would be silently dropped by the next release.
 * This module is the guard: it refuses to reconcile when it sees one.
 */

/**
 * Subjects GitHub writes when squash-merging the release PR, e.g.
 * `chore(release): develop → main (#25)`. Both the unicode arrow used in the PR title
 * and a plain ASCII `->` are accepted.
 */
export const RELEASE_COMMIT_PATTERN = /^chore\(release\): develop (?:→|->) main\b/;

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
  return RELEASE_COMMIT_PATTERN.test(commit.subject);
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
