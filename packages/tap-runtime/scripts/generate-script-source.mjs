import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');

const AGENT_MARKER = '/* __AGENT_SOURCE__ */';
const HOST_BRIDGE_MARKER = '/* __HOST_BRIDGE_SOURCE__ */';

function readSource(name) {
  return readFileSync(path.join(src, name), 'utf8');
}

function splice(template, marker, replacement) {
  if (!template.includes(marker)) {
    throw new Error(`tap-runtime: bootstrap-template.js is missing the ${marker} marker`);
  }
  return template.replace(marker, replacement);
}

const template = readSource('bootstrap-template.js');
const agentSource = readSource('agent.js');
const hostBridgeSource = readSource('host-bridge.js');

const scriptSource = splice(
  splice(template, AGENT_MARKER, agentSource),
  HOST_BRIDGE_MARKER,
  hostBridgeSource,
);

const generated = `export const TAP_SCRIPT_SOURCE = ${JSON.stringify(scriptSource)};\n`;

mkdirSync(dist, { recursive: true });
writeFileSync(path.join(dist, 'script-source.js'), generated);

// Vitest transforms src/index.ts directly rather than the compiled dist/ output, so its relative
// `./script-source.js` import needs a real file in src/ too — not just the one this script writes
// to dist/ for the package's own runtime. Gitignored: this is generated output, same as dist/.
writeFileSync(path.join(src, 'script-source.js'), generated);

console.log('Generated tap-runtime script source (%d bytes)', scriptSource.length);
