/**
 * Regenerates the per-hero energy series that `packages/domain`'s countdown tests run against.
 *
 * The series is derived from the committed raw capture, which lives in `apps/desktop` along with
 * the decoder that reads it — a dependency `packages/domain` cannot take. Rather than duplicate the
 * decoder, this reads the one field the tests need straight out of the capture's own bytes, so the
 * committed derivative is reproducible from the capture instead of being a hand-made copy nobody
 * can regenerate.
 *
 *   node tools/generate-live-capture-energy-fixture.mjs
 *
 * Pass `--check` to verify the committed file still matches what the capture produces, without
 * writing anything.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAPTURE = path.join(repoRoot, 'apps/desktop/src/main/live-source/fixtures/live-capture.bfcc');
const OUT = path.join(repoRoot, 'packages/domain/tests/fixtures/live-capture-energy-fractions.json');

const HERO_LIST = /"heroes"\s*:\s*\[(.*?)\]/gs;
const HERO_ENTRY = /\{[^{}]*\}/g;
const HERO_ID = /"id"\s*:\s*"([^"]+)"/;
const HERO_ENERGY = /"e"\s*:\s*([0-9.eE+-]+)/;

function extract(captureBytes) {
  const text = captureBytes.toString('latin1');
  const byHero = new Map();
  let tickCount = 0;

  for (const list of text.matchAll(HERO_LIST)) {
    const entries = list[1].match(HERO_ENTRY);
    if (!entries) continue;
    tickCount += 1;
    for (const entry of entries) {
      const id = HERO_ID.exec(entry)?.[1];
      const energy = HERO_ENERGY.exec(entry)?.[1];
      if (id === undefined || energy === undefined) continue;
      if (!byHero.has(id)) byHero.set(id, []);
      byHero.get(id).push(Number(energy));
    }
  }

  const energyFractionByHeroId = {};
  for (const id of [...byHero.keys()].sort()) energyFractionByHeroId[id] = byHero.get(id);
  return { tickCount, energyFractionByHeroId };
}

const extracted = extract(readFileSync(CAPTURE));
const rendered = `${JSON.stringify(extracted, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const committed = readFileSync(OUT, 'utf8');
  if (committed !== rendered) {
    console.error('live-capture-energy-fractions.json no longer matches the capture it derives from.');
    console.error('Run: node tools/generate-live-capture-energy-fixture.mjs');
    process.exit(1);
  }
  console.log(`up to date: ${extracted.tickCount} ticks, ${Object.keys(extracted.energyFractionByHeroId).length} heroes`);
} else {
  writeFileSync(OUT, rendered, 'utf8');
  console.log(`wrote ${OUT}: ${extracted.tickCount} ticks, ${Object.keys(extracted.energyFractionByHeroId).length} heroes`);
}
