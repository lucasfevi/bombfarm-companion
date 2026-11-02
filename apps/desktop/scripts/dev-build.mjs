import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Builds main and preload for the flavour the launcher resolved. The launcher defaults to `dev`
 * while the build script defaults to `prod`, so the flavour is handed over explicitly: a plain
 * `pnpm dev` keeps the dev constants.
 *
 * @param {import('@bombfarm/contracts').AppFlavor} flavor
 * @param {{ spawn?: typeof spawnSync, env?: NodeJS.ProcessEnv, execPath?: string }} [options]
 * @returns {number} the build's exit status
 */
export function runElectronBuild(flavor, { spawn = spawnSync, env = process.env, execPath = process.execPath } = {}) {
  const result = spawn(execPath, [path.join(__dirname, 'build-electron.mjs')], {
    stdio: 'inherit',
    shell: false,
    env: { ...env, BFC_FLAVOR: flavor },
  });
  return result.status ?? 1;
}
