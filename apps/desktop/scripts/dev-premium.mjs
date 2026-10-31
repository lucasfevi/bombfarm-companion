import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * `pnpm dev:premium` — the dev app running a local Premium build from the built renderer.
 *
 * `pnpm dev` loads the renderer from a dev server, whose origin cannot import the bundle's files
 * (they are served on the `app://` scheme). This builds main and the renderer in the dev flavour
 * the way the smoke suite does, then starts the unpackaged app from `app://` with the folder of
 * the local build passed through. A rebuilt bundle is picked up at the next start.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');

/** The folder of the local build: unsigned manifest and the files it lists. */
export const BUNDLE_DIR_VAR = 'BFC_PREMIUM_DEV_BUNDLE_DIR';

/** Variables a terminal can leave set that break a real Electron app or move it off `app://`. */
const DROPPED = ['ELECTRON_RUN_AS_NODE', 'ELECTRON_NO_ASAR', 'BFC_RENDERER_URL'];

/** The environment of the build steps: the dev flavour, in production mode. */
export function buildEnv(env) {
  return { ...env, NODE_ENV: 'production', BFC_FLAVOR: 'dev' };
}

/** The environment the app starts with: as the build's, with the local build's folder. */
export function launchEnv(env, bundleDir) {
  const kept = Object.fromEntries(Object.entries(env).filter(([name]) => !DROPPED.includes(name)));
  return { ...buildEnv(kept), [BUNDLE_DIR_VAR]: bundleDir };
}

/** The local build's folder: `--bundle <dir>` first, then the variable; absolute, or null. */
export function bundleDirFrom(argv, env, cwd = process.cwd()) {
  const index = argv.findIndex((arg) => arg === '--bundle' || arg.startsWith('--bundle='));
  let raw = env[BUNDLE_DIR_VAR];
  if (index !== -1) {
    const arg = argv[index];
    raw = arg.startsWith('--bundle=') ? arg.slice('--bundle='.length) : argv[index + 1];
  }
  if (raw === undefined || raw.trim() === '' || raw.startsWith('--')) return null;
  return path.resolve(cwd, raw.trim());
}

/** The build steps, in order: main and preload, the renderer, then the renderer's CSP manifest. */
export function buildSteps(root = desktopRoot, execPath = process.execPath) {
  const nextCli = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
  return [
    { command: execPath, args: [path.join(root, 'scripts', 'build-electron.mjs')] },
    { command: execPath, args: [nextCli, 'build', 'renderer'] },
    { command: execPath, args: [path.join(root, 'scripts', 'write-csp-manifest.mjs')] },
  ];
}

/** Runs the steps with the dev build environment; the first failing status, or 0. */
export function runBuild(env, { run = spawnSync, steps = buildSteps(), cwd = desktopRoot } = {}) {
  for (const step of steps) {
    const result = run(step.command, step.args, { stdio: 'inherit', shell: false, cwd, env: buildEnv(env) });
    if ((result.status ?? 1) !== 0) return result.status ?? 1;
  }
  return 0;
}

/** The Electron command and options that start the built app on `app://`. */
export function launchCommand(env, bundleDir, root = desktopRoot) {
  const electronBin =
    process.platform === 'win32'
      ? path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
      : path.join(root, 'node_modules', '.bin', 'electron');
  return {
    command: electronBin,
    args: ['.'],
    options: { stdio: 'inherit', shell: false, cwd: root, env: launchEnv(env, bundleDir) },
  };
}

const USAGE = [
  'dev:premium needs the folder of the local Premium build.',
  "Pass it with --bundle, or set the variable in this shell first:",
  `  $env:${BUNDLE_DIR_VAR} = 'C:\\path\\to\\local\\build'; pnpm dev:premium`,
].join('\n');

function main() {
  const bundleDir = bundleDirFrom(process.argv.slice(2), process.env);
  if (bundleDir === null) {
    process.stderr.write(`${USAGE}
`);
    process.exit(1);
  }
  const status = runBuild(process.env);
  if (status !== 0) process.exit(status);

  process.stdout.write(`Starting Electron (dev) from app:// with the local Premium build at ${bundleDir}
`);
  const launch = launchCommand(process.env, bundleDir);
  const app = spawn(launch.command, launch.args, launch.options);
  app.on('error', (error) => {
    process.stderr.write(`Failed to start Electron: ${String(error)}
`);
    process.exit(1);
  });
  app.on('exit', (code) => {
    process.exit(code ?? 0);
  });
  const stop = () => app.kill('SIGTERM');
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
