import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

/**
 * `pnpm dev:offline` — the dev app with no game and no server behind it.
 *
 * Sets the three overrides `dev.mjs` would otherwise need passed in by hand, then hands off to it.
 * Every one of them is already ignored by a packaged build, so this script grants nothing a real
 * install could inherit; it only saves typing.
 *
 * The renderer port defaults to 3100 rather than 3000 so this can run beside `pnpm dev:web`,
 * which holds 3000 — `dev.mjs` exits rather than sharing a port.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopRoot, '..', '..');

/**
 * Built by `scripts/generate-offline-fixture.mjs`: 13 heroes, 221 items, all five sections
 * resolved, and — the part that matters for the Live screen — a `casa` section carrying the whole
 * `/rotation` body, per-hero rotation state included, rather than only its inner `casa` child.
 */
const FIXTURE_DIR = path.join(repoRoot, 'apps', 'desktop', 'tests', 'fixtures');
const CAPTURE_DIR = path.join(repoRoot, 'apps', 'desktop', 'src', 'main', 'live-source', 'fixtures');
const DEFAULT_CAPTURE = path.join(CAPTURE_DIR, 'live-capture.bfcc');
const DEFAULT_ACCOUNT_FIXTURE = path.join(FIXTURE_DIR, 'account-offline.json');

/**
 * A scenario is a naming convention, not a table: `account-offline-<name>.json` is the account,
 * and `live-capture-<name>.bfcc` beside the default capture is its frames, used when it exists.
 * Adding a fixture pair is therefore all it takes to add a scenario — nothing here needs editing,
 * and nothing here can fall out of step with what is committed.
 *
 * The pairing is load-bearing, not a convenience. The live tap's on-field set overrules the
 * snapshot, so an account whose `field_size` disagrees with what its frames show reads "9/6" on
 * the Live screen. A scenario that narrows the field has to narrow both halves together.
 */
function captureFor(name) {
  const candidate = path.join(CAPTURE_DIR, `live-capture-${name}.bfcc`);
  return existsSync(candidate) ? candidate : null;
}

/**
 * `--account <name>` picks one of the committed `account-offline-<name>.json` fixtures; the bare
 * default is `account-offline.json`. A name rather than a path because the alternative — telling
 * people to set `BFC_FIXTURE_ACCOUNT_FILE` to an absolute Windows path — is the override most
 * likely to be left set in a PowerShell session and silently win the next run.
 *
 * An unknown name exits rather than falling back: falling back would open the app on the wrong
 * account with nothing but a banner line to say so, which is the failure this whole script is
 * built to avoid.
 *
 * Returns `null` when the flag was not passed, so the caller can tell "use the default" from "the
 * player asked for this one" — the one override here that BEATS an environment value rather than
 * yielding to it. A variable left set in a PowerShell session last week must not quietly win over
 * a name typed into this command.
 */
function scenarioFromArgv(argv) {
  const flag = argv.indexOf('--account');
  if (flag === -1) return null;

  const name = argv[flag + 1];
  if (name === undefined || name.startsWith('--')) {
    console.error('dev:offline --account needs a name, e.g. --account caps');
    printAvailableAccounts(undefined);
    process.exit(1);
  }
  if (name === 'default') return { name, account: DEFAULT_ACCOUNT_FIXTURE, capture: null };

  const account = path.join(FIXTURE_DIR, `account-offline-${name}.json`);
  if (!existsSync(account)) {
    console.error(`dev:offline: no committed account fixture named "${name}"`);
    printAvailableAccounts(name);
    process.exit(1);
  }
  return { name, account, capture: captureFor(name) };
}

function committedScenarioNames() {
  return readdirSync(FIXTURE_DIR)
    .map((file) => /^account-offline-(.+)\.json$/.exec(file)?.[1])
    .filter((name) => name !== undefined);
}

function printAvailableAccounts(typed) {
  const names = committedScenarioNames();
  console.error(`  available: default, ${names.join(', ')}`);

  // A typo costs a whole run, so name the near miss rather than leaving it to be spotted in a
  // list. Deliberately a suggestion and not an auto-correction: silently opening a scenario other
  // than the one typed is the same wrong-account-with-one-banner-line failure this script exists
  // to prevent.
  if (typed === undefined) return;
  const near = ['default', ...names].filter(
    (name) => name.startsWith(typed) || typed.startsWith(name),
  );
  if (near.length === 1) console.error(`  did you mean: --account ${near[0]}`);
}

/**
 * `predev` and `build:electron`, run from here rather than chained ahead of this script in
 * `package.json`.
 *
 * pnpm appends a run's extra arguments to the END of the whole `&&` chain, so `--account` only
 * ever reaches the last command in it. With the build steps first, a mistyped scenario name was
 * not caught until seven workspace packages and the Electron bundle had already been rebuilt.
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
    console.error(`dev:offline: could not run "${script}": ${result.error.message}`);
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

/**
 * A `$env:` variable set in a PowerShell session outlives the command that used it, so the most
 * likely reason this mode misbehaves is an override left over from an earlier run — and the
 * symptom is not an error but a quietly wrong screen. An account fixture whose `casa` section
 * carries only the house object (the shape a save export and an older payload fixture both have)
 * leaves the Live screen listing hero ids with no names and reporting no house at all, because
 * `normalizeRotation` finds no per-hero rotation state to join the roster against.
 *
 * Cheaper to check here than to diagnose from the screen.
 */
function warnIfAccountFixtureCannotDriveLive(fixturePath) {
  let payload;
  try {
    payload = JSON.parse(readFileSync(fixturePath, 'utf8'));
  } catch (error) {
    // Not a fallback: `fixture-account.ts` reads the override with an unguarded `readFileSync`,
    // so this throws inside the reader's tick, which logs `tick.failed`, reports `stale` and
    // commits no account at all. The app opens with nothing in it.
    console.warn(`  !! cannot read ${fixturePath}: ${error.message}`);
    console.warn('     The app will open with NO account data — this is not a fallback.');
    console.warn('     Unset BFC_FIXTURE_ACCOUNT_FILE to use the generated fixture this mode ships.');
    return;
  }

  const rotationHeroes = payload?.casa?.heroes;
  if (Array.isArray(rotationHeroes) && rotationHeroes.length > 0) return;

  console.warn('');
  console.warn('  !! This account fixture carries no per-hero rotation state.');
  console.warn(`     ${fixturePath}`);
  console.warn('     Its `casa` section holds only the house object, so the Live screen will list');
  console.warn('     hero ids with no names and report that no house data was sent.');
  console.warn('     Unset BFC_FIXTURE_ACCOUNT_FILE to use the generated fixture this mode ships.');
  console.warn('');
}

const scenario = scenarioFromArgv(process.argv);

/** `--account` is the one override here that BEATS an environment value rather than yielding to
 *  it — see {@link scenarioFromArgv}. */
function applyScenarioValue(name, value) {
  const displaced = process.env[name];
  process.env[name] = value;
  if (displaced !== undefined && displaced !== '' && displaced !== value) {
    return `${name}=${value} (--account)  <-- replaced ${displaced} from your environment`;
  }
  return `${name}=${value} (--account)`;
}

const applied = [
  useDefault('BFC_GAME_READER', 'fixture'),
  scenario !== null
    ? applyScenarioValue('BFC_FIXTURE_ACCOUNT_FILE', scenario.account)
    : useDefault('BFC_FIXTURE_ACCOUNT_FILE', DEFAULT_ACCOUNT_FIXTURE),
  // Named on both paths, not only when a scenario ships its own frames: every other variable here
  // announces itself when the environment already holds one, and this was the single override that
  // could win in silence — with the capture it points at deciding who is on the field.
  scenario?.capture
    ? applyScenarioValue('BFC_REPLAY_CAPTURE', scenario.capture)
    : useDefault('BFC_REPLAY_CAPTURE', DEFAULT_CAPTURE),
  useDefault('BFC_LIVE_SOURCE', 'replay'),
  useDefault('BFC_RENDERER_PORT', '3100'),
  useDefault('BFC_FLAVOR', 'dev'),
  // Its own user data, so a run never inherits an account committed by an earlier one. The
  // stored sections outlive the fixture that produced them, and a stale `casa` reaches the Live
  // screen as hero ids with no names long after the fixture behind it is gone.
  useDefault('BFC_USER_DATA_DIR', path.join(repoRoot, userDataDirName(scenario))),
];

/**
 * One database per scenario. The stored sections outlive the fixture that produced them, so a
 * shared directory means `--account caps` and then a bare `pnpm dev:offline` opens on the caps
 * account's committed `casa` until the first fixture tick overwrites it — the same stale-section
 * confusion this mode already separates itself from the shared Dev profile to avoid. The default
 * keeps the original path so an existing working directory is not orphaned.
 */
function userDataDirName(chosen) {
  return chosen === null || chosen.name === 'default'
    ? '.offline-user-data'
    : `.offline-user-data-${chosen.name}`;
}

// Resolved BEFORE anything is built, so a mistyped name costs a moment rather than a full rebuild.
runBuildStep('predev');
runBuildStep('build:electron');

console.log('Offline dev mode — no game, no server:');
for (const line of applied) console.log(`  ${line}`);
warnIfAccountFixtureCannotDriveLive(process.env.BFC_FIXTURE_ACCOUNT_FILE);
console.log('');

await import('./dev.mjs');
