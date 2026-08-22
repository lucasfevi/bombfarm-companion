#!/usr/bin/env node
/**
 * Compares a fresh perf capture against the committed baseline (`e2e/perf/baseline.json`).
 * Exact match on `medianComponentRenders` per scenario — durations are not gateable and are
 * not read here. A mismatch means either a real regression or a deliberate change that needs
 * `PERF_FORCE=1 pnpm perf:build:profile && PERF_FORCE=1 pnpm perf:capture:profile` followed by
 * hand-editing baseline.json — never a widened tolerance.
 */
import fs from 'node:fs'
import path from 'node:path'

const baselinePath = path.join(process.cwd(), 'e2e/perf/baseline.json')
const capturePath = process.env.PERF_CAPTURE_PATH
  ? path.resolve(process.env.PERF_CAPTURE_PATH)
  : path.join(process.cwd(), 'e2e/perf/out/perf-baseline.raw.json')

if (!fs.existsSync(capturePath)) {
  console.error(`[perf:compare] capture not found at ${capturePath} — run the capture first.`)
  process.exit(1)
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
const capture = JSON.parse(fs.readFileSync(capturePath, 'utf8'))

if (capture.captureMode !== baseline.captureMode) {
  console.error(
    `[perf:compare] capture mode mismatch — baseline is ${baseline.captureMode}, capture is ${capture.captureMode}. Not comparable.`,
  )
  process.exit(1)
}
if (capture.fixture !== baseline.fixture) {
  console.error(
    `[perf:compare] fixture mismatch — baseline is ${baseline.fixture}, capture is ${capture.fixture}. Not comparable.`,
  )
  process.exit(1)
}

const captured = new Map(capture.scenarios.map((s) => [s.id, s]))
let failed = false

for (const expected of baseline.scenarios) {
  const actual = captured.get(expected.id)
  if (!actual) {
    console.error(`[perf:compare] ${expected.id}: missing from this capture.`)
    failed = true
    continue
  }
  if (actual.skipped) {
    console.error(`[perf:compare] ${expected.id}: skipped in this capture, baseline expects a measurement.`)
    failed = true
    continue
  }
  if (actual.medianComponentRenders !== expected.medianComponentRenders) {
    const delta = actual.medianComponentRenders - expected.medianComponentRenders
    console.error(
      `[perf:compare] ${expected.id}: expected ${expected.medianComponentRenders} componentRenders, got ` +
        `${actual.medianComponentRenders} (${delta > 0 ? '+' : ''}${delta}). If this change is intentional, ` +
        `refresh the baseline deliberately — do not widen this check's tolerance.`,
    )
    failed = true
  }
}

if (failed) {
  process.exit(1)
}

console.log('[perf:compare] all scenarios match baseline.json.')
