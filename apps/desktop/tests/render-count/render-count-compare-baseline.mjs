#!/usr/bin/env node
/**
 * Compares a fresh render-count capture against the committed baseline
 * (`render-count-baseline.json`). Two kinds of check, and the split is the point:
 *
 * - `gate.hookInstalled` / `gate.sawCommit` are exact. They do not measure cost at all; they are
 *   what stops this instrument reporting a comfortable zero because it never attached.
 * - `gate.ranges` are inclusive bounds on the render counts. A range, not an exact number,
 *   because the counts move with the machine — see the baseline's own note.
 *
 * `distinctComponents` used to be gated exactly here and no longer is: it counts distinct
 * MINIFIED identifiers from the production bundle, so it measures the bundler's name assignment
 * rather than the app's component set, and it moved under commits that changed neither. It is
 * still captured and still printed, as context for a human reading a diff.
 *
 * A range miss means either a real regression or a deliberate change that needs a fresh capture
 * and a hand-edited baseline — never a widened tolerance to make a red run green.
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

function checkRange(label, [low, high], actual) {
  if (typeof actual !== 'number' || actual < low || actual > high) {
    console.error(`[render-count:compare] ${label}: expected ${low}-${high}, got ${actual}.`);
    failed = true;
  }
}

checkExact('hookInstalled', baseline.gate.hookInstalled, capture.hookInstalled);
checkExact('sawCommit', baseline.gate.sawCommit, capture.sawCommit);

checkRange('quiet.componentRenders', baseline.gate.ranges.quietComponentRenders, capture.quiet.componentRenders);
checkRange(
  'oneItemChange.componentRenders',
  baseline.gate.ranges.oneItemChangeComponentRenders,
  capture.oneItemChange.componentRenders,
);
checkRange(
  'oneItemChangeNetOfBackground',
  baseline.gate.ranges.oneItemChangeNetOfBackground,
  capture.oneItemChangeNetOfBackground,
);

console.log(
  `[render-count:compare] recorded (not gated): oneItemChange.distinctComponents=` +
    `${capture.oneItemChange.distinctComponents} (baseline observed ` +
    `${baseline.recordedOnly.distinctComponentsObserved.join('/')} — minified keys, not portable)`,
);

if (failed) {
  process.exit(1);
}

console.log('[render-count:compare] gated fields match render-count-baseline.json.');
