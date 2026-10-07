import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScriptSource, serializeScriptSource } from '../src/script-source-build.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');

const scriptSource = buildScriptSource();
const generated = serializeScriptSource(scriptSource);

mkdirSync(dist, { recursive: true });
writeFileSync(path.join(dist, 'script-source.js'), generated);

// Vitest transforms src/index.ts directly rather than the compiled dist/ output, so its relative
// `./script-source.js` import needs a real file in src/ too — not just the one this script writes
// to dist/ for the package's own runtime. Gitignored: this is generated output, same as dist/.
writeFileSync(path.join(src, 'script-source.js'), generated);

console.log('Generated tap-runtime script source (%d bytes)', scriptSource.length);
