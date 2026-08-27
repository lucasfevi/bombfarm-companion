#!/usr/bin/env node
/**
 * Generates the assembled-payload fixtures `packages/domain/tests` uses to prove LAR-08/09/16/17
 * (T7). Committed here so the fixtures can be regenerated and diffed rather than hand-written —
 * run `pnpm --filter @bombfarm/game-api build` first, then `node scripts/generate-domain-fixtures.mjs`
 * from `packages/game-api`.
 *
 * Drives the real `assembleAccountPayload` (T6) over the real `ROUTES` projections (T5) against
 * the committed, scrubbed 2026-08-12 calibration bodies — never hand-authored JSON.
 *
 * `buildFixtures()` is exported separately from the write loop below so a guard can import this
 * module, compute the same payloads in memory, and diff them against the committed files without
 * ever calling `writeFileSync` — see `tools/derived-fixture-drift.test.mjs`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assembleAccountPayload } from '../dist/assemble.js';
import { ROUTES } from '../dist/routes.js';
import { normalizeRotation } from '../dist/rotation/normalize.js';

const NOW = '2026-08-12T13:15:38.000Z';

function loadBodies(name) {
  const path = fileURLToPath(new URL(`../src/__fixtures__/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8'));
}

function okOutcomesFromBodies(bodies) {
  const outcomes = {};
  for (const route of ROUTES) {
    const body = bodies[route.path] ?? {};
    outcomes[route.section] = { kind: 'ok', body: route.project(body), unknownKeys: [] };
  }
  return outcomes;
}

/**
 * Every derived `packages/domain/tests/fixtures/api/*.json` file, as `{ name, payload }` pairs —
 * `name` is the committed filename, `payload` the object that must serialize (via
 * `JSON.stringify(payload, null, 2) + '\n'`, applied identically by both the writer below and the
 * drift guard) to that file's exact committed bytes.
 *
 * @returns {{ name: string, payload: unknown }[]}
 */
export function buildFixtures() {
  const before = loadBodies('api-bodies.json');
  const after = loadBodies('api-bodies-after.json');
  const fixtures = [];

  // All five sections resolved, over the before/after body pairs (LAR-09's change-detection pair).
  fixtures.push({ name: 'assembled-payload-before.json', payload: assembleAccountPayload(okOutcomesFromBodies(before), NOW) });
  fixtures.push({ name: 'assembled-payload-after.json', payload: assembleAccountPayload(okOutcomesFromBodies(after), NOW) });

  // Partial: the `account` route failed this cycle (a transport-level failure), the other four
  // resolved — grades `degraded`, and every resolved section still carries and parses (LAR-16/17).
  const partialOutcomes = okOutcomesFromBodies(before);
  partialOutcomes.account = { kind: 'failed', reason: 'transport_error' };
  fixtures.push({ name: 'assembled-payload-partial.json', payload: assembleAccountPayload(partialOutcomes, NOW) });

  // Drift: `/skill/state` answered but its shape no longer matches the fingerprint (missing
  // `totals`) — grades `degraded`, names `skills`, and carries no `skills` body at all. This is
  // the exact D24 failure (a zeroed skill tree parsed from an absent one) this rewrite exists to
  // prevent, confirmed end-to-end through F1's parser in T7's own test.
  const driftOutcomes = okOutcomesFromBodies(before);
  driftOutcomes.skills = { kind: 'drift', missingKeys: ['totals'] };
  fixtures.push({ name: 'assembled-payload-drift.json', payload: assembleAccountPayload(driftOutcomes, NOW) });

  // The `/rotation` body normalized against its own cycle's `/roster` heroes for name/grade — the
  // same join `routes.ts`'s `casa`/`heroes` sections perform in production.
  const rotationSnapshotResult = normalizeRotation(before['/rotation'], before['/roster'].heroes);
  fixtures.push({ name: 'rotation-snapshot.json', payload: rotationSnapshotResult });

  // A second, later capture whose roster is not the one the calibration bodies carry, so every
  // hero joins with no name — which is the routine absence the boundary already models, and the
  // reason this fixture is normalized against an empty roster rather than a mismatched one.
  const readyBody = loadBodies('rotation-ready.json');
  fixtures.push({ name: 'rotation-snapshot-ready.json', payload: normalizeRotation(readyBody, []) });

  return fixtures;
}

function writeFixture(name, payload) {
  const path = fileURLToPath(new URL(`../../domain/tests/fixtures/api/${name}`, import.meta.url));
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log('wrote', path);
}

// Only write when run directly (`node scripts/generate-domain-fixtures.mjs`) — importing this
// module for `buildFixtures()` (the drift guard) must never touch the working tree.
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  for (const { name, payload } of buildFixtures()) writeFixture(name, payload);
}
