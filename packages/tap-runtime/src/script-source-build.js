/**
 * The splice that turns `bootstrap-template.js` + `agent.js` + `host-bridge.js` into the one
 * source string injected into the target process.
 *
 * Pure and importable so there is exactly one definition of it rather than one per caller:
 * `scripts/generate-script-source.mjs` writes its output, `script-source-drift.test.ts`
 * recomputes it in memory and diffs it against what that script last wrote, and
 * `bootstrap-template.test.ts` runs it. A second hand-copied splice is precisely the drift a
 * drift guard cannot see.
 *
 * Plain `.js` with a hand-written `.d.ts`, the same arrangement `agent.js` and `host-bridge.js`
 * already use — but for the opposite reason. Those two are JavaScript because they run inside the
 * game process; this one is JavaScript because `tsconfig.json` sets `rootDir: src`, so a
 * `.test.ts` importing anything under `scripts/` fails the package's own `tsc` with TS6059. The
 * splice has to live under `src/` to be importable from the tests at all.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const AGENT_MARKER = '/* __AGENT_SOURCE__ */';
export const HOST_BRIDGE_MARKER = '/* __HOST_BRIDGE_SOURCE__ */';

export function spliceMarker(template, marker, replacement) {
  if (!template.includes(marker)) {
    throw new Error(`tap-runtime: bootstrap-template.js is missing the ${marker} marker`);
  }
  // Replacer function, not a string: `$&`, `$'` and friends in the spliced source would otherwise
  // be expanded as replacement patterns, corrupting the injected script with nothing to catch it
  // until it throws inside the target process.
  return template.replace(marker, () => replacement);
}

const here = path.dirname(fileURLToPath(import.meta.url));

function readSource(name) {
  return readFileSync(path.join(here, name), 'utf8');
}

export function buildScriptSource() {
  return spliceMarker(
    spliceMarker(readSource('bootstrap-template.js'), AGENT_MARKER, readSource('agent.js')),
    HOST_BRIDGE_MARKER,
    readSource('host-bridge.js'),
  );
}

export function serializeScriptSource(scriptSource) {
  return `export const TAP_SCRIPT_SOURCE = ${JSON.stringify(scriptSource)};\n`;
}
