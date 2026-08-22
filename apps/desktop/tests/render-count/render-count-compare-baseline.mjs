#!/usr/bin/env node
/**
 * Compares a fresh render-count capture against the committed baseline
 * (`render-count-baseline.json`). Same shape as the web planner's
 * `perf-compare-baseline.mjs`: exact match on the fields measured deterministic across repeated
 * runs, `baseline.recordedOnly` fields are printed for context but never gate. A `gate` mismatch
 * means either a real regression or a deliberate change that needs a fresh capture and a
 * hand-edited baseline — never a widened tolerance.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baselinePath = path.join(__dirname, 'render-count-baseline.json');
const capturePath = process.env.RENDER_COUNT_CAPTURE_PATH
  ? path.resolve(process.env.RENDER_COUNT_CAPTURE_PATH)
  : path.join(__dirname, 'out', 'render-count-capture.json');

if (!fs.existsSync(capturePath)) {
  console.error(`[render-count:compare] capture not found at ${capturePath} — run the instrument first.`);
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const capture = JSON.parse(fs.readFileSync(capturePath, 'utf8'));

let failed = false;

function checkExact(label, expected, actual) {
  if (actual !== expected) {
    console.error(`[render-count:compare] ${label}: expected ${expected}, got ${actual}.`);
    failed = true;
  }
}

checkExact('hookInstalled', baseline.gate.hookInstalled, capture.hookInstalled);
checkExact('sawCommit', baseline.gate.sawCommit, capture.sawCommit);
checkExact('oneHeroChange.distinctComponents', baseline.gate.distinctComponents, capture.oneHeroChange.distinctComponents);

console.log(
  `[render-count:compare] recorded (not gated): quiet.componentRenders=${capture.quiet.componentRenders} ` +
    `(baseline range ${baseline.recordedOnly.quietComponentRendersRange.join('-')}), ` +
    `oneHeroChange.componentRenders=${capture.oneHeroChange.componentRenders} ` +
    `(baseline range ${baseline.recordedOnly.oneHeroChangeComponentRendersRange.join('-')}), ` +
    `oneHeroChangeNetOfBackground=${capture.oneHeroChangeNetOfBackground} ` +
    `(baseline range ${baseline.recordedOnly.oneHeroChangeNetOfBackgroundRange.join('-')})`,
);

if (failed) {
  process.exit(1);
}

console.log('[render-count:compare] gated fields match render-count-baseline.json.');
