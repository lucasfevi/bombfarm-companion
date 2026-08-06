import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..');
const repoRoot = path.join(desktopRoot, '..', '..');

/**
 * Spawn a package-manager / CLI shim.
 * On Windows, Node refuses direct `.cmd` spawn without `shell: true`
 * (CVE-2024-27980 → EINVAL). Args here are fixed literals, not user input.
 */
function run(command, args, options = {}) {
  const isWindows = process.platform === 'win32';
  const executable = isWindows && !path.extname(command) ? `${command}.cmd` : command;

  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      stdio: 'inherit',
      shell: isWindows,
      cwd: desktopRoot,
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });
  });
}

async function ensureContractsBuilt() {
  const contractsEntry = path.join(repoRoot, 'packages', 'contracts', 'dist', 'index.js');
  if (existsSync(contractsEntry)) {
    return;
  }

  await run('pnpm', ['--filter', '@bombfarm/contracts', 'build'], { cwd: repoRoot });
}

await ensureContractsBuilt();

const { APP_FLAVORS, InvalidFlavorError, resolveBuildFlavor } = await import('@bombfarm/contracts');

let flavor;
try {
  flavor = resolveBuildFlavor(process.env.BFC_FLAVOR);
} catch (error) {
  if (error instanceof InvalidFlavorError) {
    console.error(error.message);
    console.error(`Valid BFC_FLAVOR tokens: ${APP_FLAVORS.join(', ')}`);
    process.exit(1);
  }
  throw error;
}

console.log(`Packaging @bombfarm/desktop (${flavor})`);

await run('pnpm', ['build']);
await run('pnpm', [
  'exec',
  'electron-builder',
  '--config',
  'electron-builder.config.mjs',
  '--publish',
  'never',
]);
