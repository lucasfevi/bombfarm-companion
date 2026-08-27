/**
 * `packages/game-api/scripts/generate-domain-fixtures.mjs` is the one documented command for
 * regenerating `packages/domain/tests/fixtures/api/*.json` — its own header comment says so, and
 * `packages/domain/tests/api-payload-parse.test.ts` cites it as the fixtures' provenance. Nothing
 * previously checked that the six committed files still match what that command produces today:
 * a hand-edit, a stale commit after the generator changed, or a bit-rotted calibration body would
 * all go unnoticed, silently, forever.
 *
 * This guard closes that gap by importing `buildFixtures()` — the same pure function the CLI's
 * write loop calls — and diffing its in-memory output against the committed bytes, rather than
 * shelling out to `node scripts/generate-domain-fixtures.mjs` and diffing the working tree (which
 * would mutate it on every test run and require an extra revert step).
 *
 * Demonstrated failing: perturbing one byte of a committed fixture and re-running this file reds
 * on that exact filename with both digests printed — see this feature's commit body for the
 * observed message.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assertWorkspaceDistBuilt } from './require-workspace-dist.mjs';

// Per-file build guard, same posture as tools/advice-change-key-coverage.test.mjs: this is the
// only other file in the `tools` project that needs a workspace package's dist/, so a project-wide
// globalSetup would still be the wrong granularity (see tools/vitest.config.ts). The two lines
// below must stay in this order: `buildFixtures` is loaded via a dynamic import so this assert
// runs first and names the actually-missing package, instead of a bare
// `Cannot find module '../dist/assemble.js'` that points nowhere near `pnpm build`.
assertWorkspaceDistBuilt('tools');

const { buildFixtures } = await import('../packages/game-api/scripts/generate-domain-fixtures.mjs');

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const API_FIXTURES_DIR = join(root, 'packages/domain/tests/fixtures/api');

function serialize(payload) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

describe('derived api fixtures match packages/game-api/scripts/generate-domain-fixtures.mjs (drift guard)', () => {
  const built = buildFixtures();

  it('non-vacuity: the generator produces at least one fixture', () => {
    expect(built.length).toBeGreaterThan(0);
  });

  it('every generated fixture name has a committed counterpart, and every committed .json file is generated', () => {
    const generatedNames = built.map((f) => f.name).sort();
    const committedNames = readdirSync(API_FIXTURES_DIR)
      .filter((name) => name.endsWith('.json'))
      .sort();
    expect(
      generatedNames,
      'generator output vs. committed directory listing must match exactly — a name on only one ' +
        'side means either a stale committed file the generator no longer produces, or a new ' +
        'generator output nobody committed',
    ).toEqual(committedNames);
  });

  for (const { name, payload } of buildFixtures()) {
    it(`${name}: committed bytes equal the generator's current output`, () => {
      const committedPath = join(API_FIXTURES_DIR, name);
      const committed = readFileSync(committedPath, 'utf8');
      const regenerated = serialize(payload);
      expect(
        committed,
        `${name} has drifted from \`node scripts/generate-domain-fixtures.mjs\` (run from packages/game-api) — ` +
          're-run the generator and commit its output, or the calibration bodies/generator changed ' +
          'without regenerating this file.',
      ).toBe(regenerated);
    });
  }
});
