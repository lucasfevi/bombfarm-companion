#!/usr/bin/env node
/**
 * Flatten Playwright screenshot diff PNGs from test-results/ into visual-diffs/.
 *
 * Every test job runs this; the `report` job merges all shards' output into one
 * folder that is published next to the merged HTML report and linked inline
 * from the PR comment.
 *
 * Retries are collapsed: Playwright writes `<test>-retry1/` alongside `<test>/`,
 * which would list the same screenshot twice. Only the final attempt is kept,
 * under the un-suffixed name.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'test-results');
const OUT = path.join(ROOT, 'visual-diffs');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function kindOf(file) {
  const m = /-(expected|actual|diff)\.png$/i.exec(file);
  return m ? m[1].toLowerCase() : null;
}

/** `foo-chromium-retry2` → { base: 'foo-chromium', attempt: 2 } */
function parseAttempt(dirName) {
  const m = /^(.*)-retry(\d+)$/.exec(dirName);
  return m ? { base: m[1], attempt: Number(m[2]) } : { base: dirName, attempt: 0 };
}

function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const hits = walk(SRC).filter((p) => kindOf(p));
  if (hits.length === 0) {
    console.log('No visual diff PNGs under test-results/');
    return;
  }

  // key = `${base}-${kind}` → winning source path (highest attempt)
  const winners = new Map();
  for (const src of hits) {
    const { base, attempt } = parseAttempt(path.basename(path.dirname(src)));
    const key = `${base}-${kindOf(src)}`;
    const current = winners.get(key);
    if (!current || attempt > current.attempt) winners.set(key, { src, attempt });
  }

  for (const [key, { src }] of [...winners].sort(([a], [b]) => a.localeCompare(b))) {
    const dest = path.join(OUT, `${key}.png`);
    fs.copyFileSync(src, dest);
    console.log(path.relative(ROOT, dest));
  }
}

main();
