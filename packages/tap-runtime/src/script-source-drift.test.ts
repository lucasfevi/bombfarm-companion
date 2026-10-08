/**
 * `src/script-source.js` is generated and gitignored: `scripts/generate-script-source.mjs` writes
 * it (and the `dist/` copy the packaged app loads) from the three committed files beside this one.
 * Nothing checked that the two still agree, so an edit to `bootstrap-template.js`, `agent.js` or
 * `host-bridge.js` committed without re-running the build left every consumer — `index.ts`, the
 * desktop app, a packaged release — loading a stale script while the committed source read as
 * current. Silently, and for as long as nobody rebuilt.
 *
 * The check imports `buildScriptSource()`, the same pure function the generator's write loop
 * calls, and diffs its in-memory result against what the artifact actually holds — rather than
 * shelling out to the generator and diffing the working tree, which would rewrite generated files
 * on every test run.
 *
 * It lives in this package rather than in `tools/` on purpose. Its whole subject — template,
 * agent, bridge, generator, artifact — is inside `packages/tap-runtime`, so it belongs to the CI
 * job that builds this package (`ci-desktop`, which builds `@bombfarm/tap-runtime` before running
 * tests). The `tools` project is deliberately unfiltered and builds only four packages, none of
 * them this one, so a guard placed there would have had nothing to compare against.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AGENT_MARKER,
  HOST_BRIDGE_MARKER,
  buildScriptSource,
  serializeScriptSource,
  spliceMarker,
} from './script-source-build.js';

const GENERATED_PATH = fileURLToPath(new URL('./script-source.js', import.meta.url));

function isCi(): boolean {
  const raw = process.env.CI;
  if (raw === undefined || raw === '') return false;
  const normalized = raw.toLowerCase();
  return normalized !== '0' && normalized !== 'false';
}

/**
 * The generated artifact is absent on a tree that has never been built. Locally that is an
 * ordinary state and the skip says how to fix it; in CI it is a failure, because a drift guard
 * that skips when its subject is missing is exactly the quiet pass this file exists to end.
 */
function requireGenerated(): boolean {
  if (existsSync(GENERATED_PATH)) return true;
  if (isCi()) {
    throw new Error(
      `[tap-runtime] ${GENERATED_PATH} is missing in CI, so the generated script source cannot be ` +
        'compared against the committed template. Build @bombfarm/tap-runtime before running its ' +
        'tests — this guard intentionally does not skip when its artifact is absent.',
    );
  }
  console.info(
    `[tap-runtime] ${GENERATED_PATH} absent — skipping the script-source drift check. Run ` +
      '`pnpm --filter @bombfarm/tap-runtime build` to exercise it locally. (In CI a missing ' +
      'artifact fails the test.)',
  );
  return false;
}

const generatedPresent = requireGenerated();
const generated: { TAP_SCRIPT_SOURCE: string } | null = generatedPresent
  ? await import('./script-source.js')
  : null;

describe('the generated script source matches the committed template (drift guard)', () => {
  const built = buildScriptSource();

  it('non-vacuity: the splice produced a script that carries both spliced modules', () => {
    expect(built).not.toContain(AGENT_MARKER);
    expect(built).not.toContain(HOST_BRIDGE_MARKER);
    expect(built).toContain('function createAgent(host)');
    expect(built).toContain('function createHostBridge(frida, createAgent)');
  });

  it('the generated artifact exports exactly the bytes the committed sources splice to', () => {
    if (!generated) return;
    expect(
      generated.TAP_SCRIPT_SOURCE,
      'src/script-source.js has drifted from bootstrap-template.js / agent.js / host-bridge.js — ' +
        're-run `pnpm --filter @bombfarm/tap-runtime build`, or the template changed without the ' +
        'generated script being rebuilt and every consumer is loading the stale one.',
    ).toBe(built);
  });

  it('the serialized form is the module shape the artifact is written as', () => {
    if (!generated) return;
    expect(serializeScriptSource(generated.TAP_SCRIPT_SOURCE)).toBe(serializeScriptSource(built));
  });

  it('splices with a replacer function, so a `$&` in the injected source survives verbatim', () => {
    // A string replacement would expand `$&` to the marker it replaced and `$'` to the rest of the
    // template, corrupting the injected script with nothing to catch it until it throws inside the
    // game process.
    const pattern = "const sigil = \"$& $' $` $$\";";
    expect(spliceMarker(`before ${AGENT_MARKER} after`, AGENT_MARKER, pattern)).toBe(
      `before ${pattern} after`,
    );
  });

  it('refuses to splice a template whose marker is gone, instead of silently dropping a module', () => {
    expect(() => spliceMarker('no markers here', AGENT_MARKER, 'x')).toThrow(/missing the/);
  });
});
