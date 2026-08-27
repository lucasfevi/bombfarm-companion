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
  return `${name}=${process.env[name]} (from environment)`;
}

const applied = [
  useDefault('BFC_GAME_READER', 'fixture'),
  useDefault('BFC_FIXTURE_ACCOUNT_FILE', DEFAULT_ACCOUNT_FIXTURE),
  useDefault('BFC_LIVE_SOURCE', 'replay'),
  useDefault('BFC_RENDERER_PORT', '3100'),
  useDefault('BFC_FLAVOR', 'dev'),
];

console.log('Offline dev mode — no game, no server:');
for (const line of applied) console.log(`  ${line}`);
console.log('');

await import('./dev.mjs');
