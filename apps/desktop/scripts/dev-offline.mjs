import { readFileSync } from 'node:fs';
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
const repoRoot = path.resolve(__dirname, '..', '..', '..');

/**
 * Built by `scripts/generate-offline-fixture.mjs` from the committed calibration bodies, through
 * the real route projections: 8 heroes, 30 items, all five sections resolved, and — the part that
 * matters for the Live screen — a `casa` section carrying the whole `/rotation` body, per-hero
 * rotation state included, rather than only its inner `casa` child.
 */
const DEFAULT_ACCOUNT_FIXTURE = path.join(
  repoRoot,
  'apps',
  'desktop',
  'tests',
  'fixtures',
  'account-offline.json',
);

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
    console.warn(`  !! cannot read ${fixturePath}: ${error.message}`);
    console.warn('     The app will fall back to the committed game-data bundle.');
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

const applied = [
  useDefault('BFC_GAME_READER', 'fixture'),
  useDefault('BFC_FIXTURE_ACCOUNT_FILE', DEFAULT_ACCOUNT_FIXTURE),
  useDefault('BFC_LIVE_SOURCE', 'replay'),
  useDefault('BFC_RENDERER_PORT', '3100'),
  useDefault('BFC_FLAVOR', 'dev'),
  // Its own user data, so a run never inherits an account committed by an earlier one. The
  // stored sections outlive the fixture that produced them, and a stale `casa` reaches the Live
  // screen as hero ids with no names long after the fixture behind it is gone.
  useDefault('BFC_USER_DATA_DIR', path.join(repoRoot, '.offline-user-data')),
];

console.log('Offline dev mode — no game, no server:');
for (const line of applied) console.log(`  ${line}`);
warnIfAccountFixtureCannotDriveLive(process.env.BFC_FIXTURE_ACCOUNT_FILE);
console.log('');

await import('./dev.mjs');
