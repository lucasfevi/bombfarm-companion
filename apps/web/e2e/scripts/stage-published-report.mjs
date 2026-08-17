#!/usr/bin/env node
/**
 * Stage the copy of the merged Playwright report that goes to GitHub Pages.
 *
 * Trace zips are dropped here: they embed page snapshots, network payloads and
 * source. Full traces stay in the Actions `e2e-report` artifact for local debugging.
 *
 * Layout: publish-report/{index.html,data/…,diffs/…}
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REPORT = path.join(ROOT, 'playwright-report');
const DIFFS = path.join(ROOT, 'visual-diffs');
const OUT = path.join(ROOT, 'publish-report');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function main() {
  if (!fs.existsSync(path.join(REPORT, 'index.html'))) {
    console.error(`No merged report at ${path.relative(ROOT, REPORT)}/index.html`);
    process.exit(1);
  }

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.cpSync(REPORT, OUT, { recursive: true });

  let stripped = 0;
  let strippedBytes = 0;
  for (const file of walk(OUT)) {
    if (!file.toLowerCase().endsWith('.zip')) continue;
    strippedBytes += fs.statSync(file).size;
    fs.rmSync(file);
    stripped++;
  }

  let diffCount = 0;
  if (fs.existsSync(DIFFS)) {
    const pngs = fs.readdirSync(DIFFS).filter((n) => n.toLowerCase().endsWith('.png'));
    if (pngs.length > 0) {
      fs.mkdirSync(path.join(OUT, 'diffs'), { recursive: true });
      for (const name of pngs) {
        fs.copyFileSync(path.join(DIFFS, name), path.join(OUT, 'diffs', name));
        diffCount++;
      }
    }
  }

  const mb = (strippedBytes / 1024 / 1024).toFixed(1);
  console.log(`Staged publish-report/ — stripped ${stripped} trace zip(s) (${mb} MB), ${diffCount} diff PNG(s)`);
}

main();
