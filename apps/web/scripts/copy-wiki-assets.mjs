/**
 * Mirrors `@bombfarm/game-art`'s bundled sprites into `public/wiki-assets` so Next serves them
 * at `/wiki-assets/...` — the URL shape `packages/domain/src/wiki-assets.ts` builds. The package
 * carries the assets; this app (like `apps/desktop`) copies them into its own `public/` because
 * Next's static export only serves files that live under the app's own public root.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, '..');
const source = path.join(webRoot, '../../packages/game-art/assets');
const destination = path.join(webRoot, 'public/wiki-assets');

fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(source, destination, { recursive: true });
