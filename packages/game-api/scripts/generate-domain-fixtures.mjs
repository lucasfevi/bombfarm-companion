#!/usr/bin/env node
/**
 * Generates the assembled-payload fixtures `packages/domain/tests` uses to prove LAR-08/09/16/17
 * (T7). Committed here so the fixtures can be regenerated and diffed rather than hand-written —
 * run `pnpm --filter @bombfarm/game-api build` first, then `node scripts/generate-domain-fixtures.mjs`
 * from `packages/game-api`.
 *
 * Drives the real `assembleAccountPayload` (T6) over the real `ROUTES` projections (T5) against
 * the committed, scrubbed 2026-08-12 calibration bodies — never hand-authored JSON.
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

function writeFixture(name, payload) {
  const path = fileURLToPath(new URL(`../../domain/tests/fixtures/api/${name}`, import.meta.url));
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log('wrote', path);
}

const before = loadBodies('api-bodies.json');
const after = loadBodies('api-bodies-after.json');

// All five sections resolved, over the before/after body pairs (LAR-09's change-detection pair).
writeFixture('assembled-payload-before.json', assembleAccountPayload(okOutcomesFromBodies(before), NOW));
writeFixture('assembled-payload-after.json', assembleAccountPayload(okOutcomesFromBodies(after), NOW));

// Partial: the `account` route failed this cycle (a transport-level failure), the other four
// resolved — grades `degraded`, and every resolved section still carries and parses (LAR-16/17).
const partialOutcomes = okOutcomesFromBodies(before);
partialOutcomes.account = { kind: 'failed', reason: 'transport_error' };
writeFixture('assembled-payload-partial.json', assembleAccountPayload(partialOutcomes, NOW));

// Drift: `/skill/state` answered but its shape no longer matches the fingerprint (missing
// `totals`) — grades `degraded`, names `skills`, and carries no `skills` body at all. This is
// the exact D24 failure (a zeroed skill tree parsed from an absent one) this rewrite exists to
// prevent, confirmed end-to-end through F1's parser in T7's own test.
const driftOutcomes = okOutcomesFromBodies(before);
driftOutcomes.skills = { kind: 'drift', missingKeys: ['totals'] };
writeFixture('assembled-payload-drift.json', assembleAccountPayload(driftOutcomes, NOW));

// The `/rotation` body normalized against its own cycle's `/roster` heroes for name/grade — the
// same join `routes.ts`'s `casa`/`heroes` sections perform in production.
const rotationSnapshotResult = normalizeRotation(before['/rotation'], before['/roster'].heroes);
writeFixture('rotation-snapshot.json', rotationSnapshotResult);

// A second, later capture whose roster is not the one the calibration bodies carry, so every
// hero joins with no name — which is the routine absence the boundary already models, and the
// reason this fixture is normalized against an empty roster rather than a mismatched one.
const readyBody = loadBodies('rotation-ready.json');
writeFixture('rotation-snapshot-ready.json', normalizeRotation(readyBody, []));
