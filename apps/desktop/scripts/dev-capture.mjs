import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

/**
 * `pnpm dev:capture` — the dev app, recording everything the tap observes.
 *
 * Every REST body the client receives is written to a newline-delimited JSON file, including the
 * ones the app cannot identify and normally discards; so are the live frames, wire keys and all.
 * That is the point: the questions this mode exists to answer are about traffic no shipped code
 * path keeps.
 *
 * It deliberately does NOT set the replay live source the way `dev:offline` does. Replayed frames
 * come from a committed capture and would answer nothing — this mode wants the real client's real
 * traffic.
 *
 * Both overrides here are ignored by a packaged build, so this script grants nothing an install
 * could inherit; it only saves typing.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');

const DEV_DATA_DIR_NAME = 'Bomb Farm Companion (Dev)';

/**
 * `predev` and `build:electron`, run from here rather than chained ahead of this script in
 * `package.json` — the same reason `dev-offline.mjs` does it: pnpm appends a run's extra arguments
 * to the end of an `&&` chain, so anything typed after the script name never reaches it.
 *
 * Invoked as `node <pnpm's own entry> <script>` rather than by name, the way `dev.mjs` starts Next:
 * no PATH lookup, no `.cmd` shim, and nothing for cmd.exe to re-parse.
 */
function runBuildStep(script) {
  const pnpmEntry = process.env.npm_execpath;
  const hasEntry = pnpmEntry !== undefined && pnpmEntry !== '';
  // `npm_execpath` is pnpm's JS CLI under a normal install, but a standalone `@pnpm/exe` install
  // points it at the executable itself — which `node` cannot run.
  const entryIsScript = hasEntry && /\.[cm]?js$/.test(pnpmEntry);

  const [command, leading] = entryIsScript
    ? [process.execPath, [pnpmEntry]]
    : hasEntry
      ? [pnpmEntry, []]
      : ['pnpm', []];

  const result = spawnSync(command, [...leading, script], {
    cwd: desktopRoot,
    stdio: 'inherit',
    // Only the last resort goes through a shell, and only because Node refuses to spawn a Windows
    // `.cmd` shim without one (the CVE-2024-27980 fix): a bare `pnpm` here IS that shim. Nothing
    // player-supplied reaches this — `script` is one of two literals below.
    shell: !hasEntry && process.platform === 'win32',
  });
  if (result.error !== undefined) {
    console.error(`dev:capture: could not run "${script}": ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function useDefault(name, value) {
  if (process.env[name] === undefined || process.env[name] === '') {
    process.env[name] = value;
    return `${name}=${value} (default)`;
  }
  return `${name}=${process.env[name]}  <-- FROM YOUR ENVIRONMENT, not this script`;
}

/** Mirrors `resolveAppEnv`: an unpackaged run honours `BFC_USER_DATA_DIR`, otherwise the dev
 *  flavor's own directory under %APPDATA%. Printed rather than guessed at, because the whole
 *  point of announcing the destination is that it is the one true answer. */
function captureDirectory() {
  const override = process.env.BFC_USER_DATA_DIR;
  if (override !== undefined && override !== '') return path.join(override, 'observation-capture');

  const appData =
    process.env.APPDATA ?? path.join(process.env.USERPROFILE ?? '', 'AppData', 'Roaming');
  return path.join(appData, DEV_DATA_DIR_NAME, 'observation-capture');
}

const applied = [useDefault('BFC_OBSERVATION_CAPTURE', '1'), useDefault('BFC_FLAVOR', 'dev')];

runBuildStep('predev');
runBuildStep('build:electron');

console.log('Capture dev mode — recording every body and frame the tap observes:');
for (const line of applied) console.log(`  ${line}`);
console.log('');
console.log(`  Recordings are written to: ${captureDirectory()}`);
console.log('  One file per run, named by the time it started.');
console.log('');
console.log('  !! These recordings contain LIVE ACCOUNT DATA from your own game session.');
console.log('     Nothing deletes them for you, and they must never be committed.');
console.log('     The session token is redacted; everything else is recorded as observed.');
console.log('');

await import('./dev.mjs');
