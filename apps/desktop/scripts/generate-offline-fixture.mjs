import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

/**
 * Regenerates `tests/fixtures/account-offline.json`, the account `pnpm dev:offline` runs against.
 *
 * Drives the real `ROUTES` projections and the real `assembleAccountPayload` over the committed,
 * scrubbed calibration bodies — never hand-authored JSON. That matters for one specific reason:
 * `/rotation` projects its *whole* body into the `casa` section, per-hero rotation state included,
 * and a fixture that carried only the inner `casa` child would leave the Live screen with no
 * roster to fold frames onto. Running the real projection is what keeps this file honest as that
 * projection changes.
 *
 * Run `pnpm --filter @bombfarm/game-api build` first, then from `apps/desktop`:
 *   node scripts/generate-offline-fixture.mjs
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopRoot, '..', '..');
const gameApiDist = path.join(repoRoot, 'packages', 'game-api', 'dist');

/** The instant the calibration bodies were captured — fixed so regenerating is a no-op diff. */
const CAPTURED_AT = '2026-08-12T13:15:38.000Z';

const { ROUTES } = await import(pathToFileURL(path.join(gameApiDist, 'routes.js')).href);
const { assembleAccountPayload } = await import(pathToFileURL(path.join(gameApiDist, 'assemble.js')).href);

const bodies = JSON.parse(
  readFileSync(
    path.join(repoRoot, 'packages', 'game-api', 'src', '__fixtures__', 'api-bodies.json'),
    'utf8',
  ),
);

const outcomes = {};
for (const route of ROUTES) {
  outcomes[route.section] = {
    kind: 'ok',
    body: route.project(bodies[route.path] ?? {}),
    unknownKeys: [],
  };
}

const payload = assembleAccountPayload(outcomes, CAPTURED_AT);

/**
 * The account bodies and the replay capture come from two different accounts, and their hero ids
 * are disjoint — which leaves the Live screen counting the capture's heroes on the field while
 * listing none of them, because the roster join finds nothing. Re-keying the account's heroes onto
 * the capture's ids makes the two fixtures describe one account.
 *
 * Only the opaque id is substituted: every level, energy value, name, rarity and rotation state
 * stays exactly as captured, and the capture's own bytes are never touched. Heroes past the
 * capture's own hero count keep their original ids — the roster is simply larger than what that
 * six-second slice happened to show on the field.
 */
function replayHeroIdsInFirstAppearanceOrder() {
  const bytes = readFileSync(
    path.join(desktopRoot, 'src', 'main', 'live-source', 'fixtures', 'live-capture.bfcc'),
  );

  // The `.bfcc` container, per capture-format.ts: a 5-byte header, then records of
  // ctxType(1) ctxLength(4 LE) ctx payloadLength(4 LE) payload. Parsed here rather than imported
  // because `capture-format.ts` is bundled into the Electron main output, not emitted per module.
  const seen = [];
  let offset = 5;
  while (offset + 5 <= bytes.length) {
    const ctxLength = bytes.readUInt32LE(offset + 1);
    const payloadStart = offset + 5 + ctxLength + 4;
    if (payloadStart > bytes.length) break;
    const payloadLength = bytes.readUInt32LE(offset + 5 + ctxLength);
    const payloadEnd = payloadStart + payloadLength;
    if (payloadEnd > bytes.length) break;

    // Each record holds one server text frame; the JSON starts at its first brace.
    const payload = bytes.subarray(payloadStart, payloadEnd);
    const braceAt = payload.indexOf(0x7b);
    if (braceAt !== -1) {
      try {
        const frame = JSON.parse(payload.subarray(braceAt).toString('utf8'));
        for (const hero of frame.heroes ?? []) {
          if (typeof hero?.id === 'string' && !seen.includes(hero.id)) seen.push(hero.id);
        }
      } catch {
        // A record that is not a complete frame contributes no ids; the rest still do.
      }
    }
    offset = payloadEnd;
  }
  return seen;
}

const replayIds = replayHeroIdsInFirstAppearanceOrder();
const roster = payload.heroes ?? [];
const idByOriginal = new Map();
roster.forEach((hero, index) => {
  const replacement = replayIds[index];
  if (replacement !== undefined) idByOriginal.set(String(hero.id), replacement);
});

const rekey = (hero) => {
  const replacement = idByOriginal.get(String(hero.id));
  return replacement === undefined ? hero : { ...hero, id: replacement };
};

const rekeyed = {
  ...payload,
  heroes: roster.map(rekey),
  ...(payload.casa !== undefined
    ? {
        casa: {
          ...payload.casa,
          ...(Array.isArray(payload.casa.heroes) ? { heroes: payload.casa.heroes.map(rekey) } : {}),
        },
      }
    : {}),
};

const destination = path.join(desktopRoot, 'tests', 'fixtures', 'account-offline.json');
writeFileSync(destination, `${JSON.stringify(rekeyed, null, 2)}\n`, 'utf8');

const rotationHeroes = Array.isArray(rekeyed.casa?.heroes) ? rekeyed.casa.heroes.length : 0;
console.log(`wrote ${destination}`);
console.log(
  `  ${(rekeyed.heroes ?? []).length} roster heroes, ${(rekeyed.items ?? []).length} items, ` +
    `${rotationHeroes} heroes with rotation state`,
);
console.log(`  ${idByOriginal.size} of them re-keyed onto the replay capture's hero ids`);
