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
import { register } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Only when run directly does this chain cross Node's own ESM loader — Vitest's module runner
// (the drift guard's `import()`) already tolerates the missing attribute, so the hook is
// registered here rather than unconditionally, to keep its effect scoped to this command.
// Must run before the dynamic imports below load `../dist/**`, which is why both `isMain` and
// this registration happen ahead of them instead of at the bottom of the file. See
// `json-import-hooks.mjs` for why the attribute is missing at all.
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  register(new URL('./json-import-hooks.mjs', import.meta.url));
}

const { assembleAccountPayload } = await import('../dist/assemble.js');
const { ROUTES } = await import('../dist/routes.js');
const { normalizeRotation } = await import('../dist/rotation/normalize.js');

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
 * `name` is the committed filename, `payload` the object that {@link serializeFixture} turns into
 * that file's exact committed bytes.
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

/**
 * The exact byte format every committed `packages/domain/tests/fixtures/api/*.json` file must
 * match — shared with `tools/derived-fixture-drift.test.mjs` so there is one definition, not a
 * hand-copied second one that could silently drift from this one.
 */
export function serializeFixture(payload) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function writeFixture(name, payload) {
  const path = fileURLToPath(new URL(`../../domain/tests/fixtures/api/${name}`, import.meta.url));
  writeFileSync(path, serializeFixture(payload), 'utf8');
  console.log('wrote', path);
}

// Only write when run directly (`node scripts/generate-domain-fixtures.mjs`) — importing this
// module for `buildFixtures()` (the drift guard) must never touch the working tree.
if (isMain) {
  for (const { name, payload } of buildFixtures()) writeFixture(name, payload);
}
