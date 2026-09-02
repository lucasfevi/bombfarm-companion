/**
 * The data branch is a single orphan commit carrying one JSON file, and Vercel's Git integration
 * still opens a preview build for every push to it. That build fails — the branch has no
 * `apps/web`, which is the project's configured Root Directory — and mails the owner, several
 * times an hour, for a branch that is not an application at all.
 *
 * It cannot be turned off from the dashboard: Preview branch tracking covers every branch not
 * assigned to another environment and its matcher is fixed, so there is nothing to subtract a
 * branch from. What Vercel does honour is `git.deploymentEnabled`, read from the pushed commit
 * before the deployment is created. So the branch carries its own opt-out.
 *
 * Both paths get it because project configuration resolves against the Root Directory, and
 * whether the pre-deployment check honours that or reads the repository root is undocumented.
 * Two small files on a derived branch is the cheap side of that bet.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEPLOY_OPTOUT_PATHS = ['vercel.json', 'apps/web/vercel.json'];

/** One payload for every path, so the copies cannot drift into disagreeing. */
export function deployOptOut(dataBranch) {
  const config = {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    git: { deploymentEnabled: { [dataBranch]: false } },
  };
  return `${JSON.stringify(config, null, 2)}\n`;
}

/** The files to add to the published commit, in the shape both publishers commit them. */
export function deployOptOutFiles(dataBranch) {
  const content = deployOptOut(dataBranch);
  return DEPLOY_OPTOUT_PATHS.map((path) => ({ path, content }));
}

/** Write them into a working tree, for the publisher that commits with git rather than the API. */
export function writeDeployOptOut(root, dataBranch) {
  for (const file of deployOptOutFiles(dataBranch)) {
    const target = join(root, file.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.content, 'utf-8');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [root, dataBranch] = process.argv.slice(2);
  if (!root || !dataBranch) {
    console.error('usage: deploy-optout.mjs <worktree> <data-branch>');
    process.exit(2);
  }
  writeDeployOptOut(root, dataBranch);
}
