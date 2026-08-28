import { pathToFileURL } from 'node:url';

export const DEFAULT_PROTECTED_BRANCHES = ['main', 'develop'];

export const CONVENTIONAL_BRANCH_TYPES = [
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
];

export const CONVENTIONAL_BRANCH_PATTERN = new RegExp(
  `^(${CONVENTIONAL_BRANCH_TYPES.join('|')})/[a-z0-9]+(-[a-z0-9]+)*$`,
);

export const NAMING_EXEMPT_BRANCHES = ['main', 'develop', 'release/next', 'gh-pages'];

export const NAMING_EXEMPT_PREFIXES = ['backup/'];

function branchName(remoteRef) {
  const prefix = 'refs/heads/';
  return remoteRef.startsWith(prefix) ? remoteRef.slice(prefix.length) : null;
}

function isNamingExempt(branch) {
  return (
    NAMING_EXEMPT_BRANCHES.includes(branch) ||
    NAMING_EXEMPT_PREFIXES.some((prefix) => branch.startsWith(prefix))
  );
}

function isDeletion(localSha) {
  return /^0+$/.test(localSha);
}

export function evaluatePushRefs(stdinText, { protectedBranches }) {
  const blocked = [];
  const misnamed = [];
  const seen = new Set();
  const lines = stdinText.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 3) continue;

    const [, localSha, remoteRef] = parts;
    const branch = branchName(remoteRef);
    if (!branch || seen.has(branch)) continue;
    seen.add(branch);

    if (protectedBranches.includes(branch)) {
      blocked.push(branch);
      continue;
    }

    // Deleting a badly-named branch is how you finish renaming one, so never refuse it.
    if (isDeletion(localSha) || isNamingExempt(branch)) continue;

    if (!CONVENTIONAL_BRANCH_PATTERN.test(branch)) misnamed.push(branch);
  }

  return { blocked, misnamed, allowed: blocked.length === 0 && misnamed.length === 0 };
}

export function formatRefusalMessage(blocked) {
  const names = blocked.join(', ');
  return (
    `Direct push to ${names} is blocked. Open a PR into develop instead. ` +
    `Bypass with git push --no-verify if this is a legitimate release action.`
  );
}

export function formatNamingRefusalMessage(misnamed) {
  const names = misnamed.join(', ');
  return (
    `Branch name ${names} is not conventional. Rename it before pushing:\n` +
    `  git branch -m <type>/<kebab-case-summary>\n` +
    `Types: ${CONVENTIONAL_BRANCH_TYPES.join(', ')}. See docs/branching.md#branch-names. ` +
    `Bypass with git push --no-verify.`
  );
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function isCliEntry() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isCliEntry()) {
  const { blocked, misnamed } = evaluatePushRefs(await readStdin(), {
    protectedBranches: DEFAULT_PROTECTED_BRANCHES,
  });
  if (blocked.length > 0) console.error(formatRefusalMessage(blocked));
  if (misnamed.length > 0) console.error(formatNamingRefusalMessage(misnamed));
  if (blocked.length > 0 || misnamed.length > 0) process.exitCode = 1;
}
