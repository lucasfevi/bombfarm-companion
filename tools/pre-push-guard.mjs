import { pathToFileURL } from 'node:url';

export const DEFAULT_PROTECTED_BRANCHES = ['main', 'develop'];

function branchName(remoteRef) {
  const prefix = 'refs/heads/';
  return remoteRef.startsWith(prefix) ? remoteRef.slice(prefix.length) : null;
}

export function evaluatePushRefs(stdinText, { protectedBranches }) {
  const blocked = [];
  const seen = new Set();
  const lines = stdinText.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 3) continue;

    const remoteRef = parts[2];
    const branch = branchName(remoteRef);
    if (!branch || !protectedBranches.includes(branch) || seen.has(branch)) continue;

    seen.add(branch);
    blocked.push(branch);
  }

  return { blocked, allowed: blocked.length === 0 };
}

export function formatRefusalMessage(blocked) {
  const names = blocked.join(', ');
  return (
    `Direct push to ${names} is blocked. Open a PR into develop instead. ` +
    `Bypass with git push --no-verify if this is a legitimate release action.`
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
  const { blocked } = evaluatePushRefs(await readStdin(), {
    protectedBranches: DEFAULT_PROTECTED_BRANCHES,
  });
  if (blocked.length > 0) {
    console.error(formatRefusalMessage(blocked));
    process.exitCode = 1;
  }
}
