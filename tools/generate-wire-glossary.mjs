#!/usr/bin/env node
// Regenerates docs/wire-vocabulary.md from the rotation wire lexicon
// (packages/game-api/src/rotation/lexicon.ts). Run `pnpm build` first — this imports the built
// @bombfarm/game-api dist, mirroring packages/game-api/scripts/generate-domain-fixtures.mjs's
// own build-then-import convention.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderWireGlossary } from '@bombfarm/game-api';

const outPath = fileURLToPath(new URL('../docs/wire-vocabulary.md', import.meta.url));
writeFileSync(outPath, renderWireGlossary(), 'utf8');
console.log('wrote', outPath);
